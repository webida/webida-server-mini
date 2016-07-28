'use strict';

const {path, URI, _, debugFactory} = __webida.libs;
const debug = debugFactory(module);

const bunyan = require('bunyan');

const EventBus = require('./EventBus.js');
const JsonFile = require('./JsonFile.js');
const ComponentRegistry = require('./ComponentRegistry.js');
const homeManager = require('./init/home-manager.js');

const RestifyBuilder = require('./components/http-service/RestifyBuilder.js');
const SocketServer = require('./components/SocketService.js');

// To have concurrent, mulitiple instances of server
// env.disableLogRotate should be truthy,
// for rotating same file multiple times can be a disaster
const LOGGER_OPTIONS = {
    name: 'webida',
    level: __webida.env.debug ? 'debug' : (__webida.env.logLevel || 'info') ,
    streams: [{
        type: __webida.env.disableLogRorate ? 'file' : 'rotating-file',
        path: __webida.env.logPath || path.resolve(__webida.env.serverHome, 'logs', 'server.log'),
        period: __webida.env.logRotatingPeriod || '1d',
        count: __webida.env.logRotatingCount * 1 || 5
    }]
};

const WEBIDA_SERVER_CONFIG_PATH = path.resolve(__webida.env.serverHome, 'config.json');

class WebidaServer {

    constructor(configPath, contentsDirPath, logSuffix) {
        this._configPath = configPath || WEBIDA_SERVER_CONFIG_PATH;
        this._eventBus = new EventBus();
        this.contentsDir = contentsDirPath || __webida.env.contentsDir ||
            path.resolve(__webida.env.serverRoot, 'contents');
        this._logger = WebidaServer._createLogger(logSuffix);
        this._componentRegistry = new ComponentRegistry();

        // following properties will be set in init() phase
        this._config = null;
        this._serviceUrl = null;
        this._lifecycleChannel = null;

    }

    static _createLogger(logSuffix) {
        let loggerOptions = _.cloneDeep(LOGGER_OPTIONS);
        if (logSuffix)
            loggerOptions.streams[0].path += logSuffix;

        // when server destroys, logger should be nullified with closing.
        //  afaik, there's no way to close log streams directly
        //  and we should use process exit handler
        return bunyan.createLogger(loggerOptions);
    }

    get serviceUrl() { return this._serviceUrl; }
    get config() { return this._config; }

    init() {
        return this._init()._initSelf( ()=> {
            // server init will be completed
            // when 'http-service' and 'socket-service' is initialized.
            // do we have to
            return this._dispatchLifecycleEvent('init').then( () => {
                this._logger.info({_serviceUrl: this._serviceUrl}, 'server initialized');
                return this;
            });
        });
    }

    // self-init
    _initSelf() {
        return homeManager.ensureHaveServerHome()
            .then( () => this._loadConfig() )
            .then( config => {
                // TODO: Configuration may have to extracted to a component
                //  for other components can subscribe config change event easily.
                let uri = new URI(config.url).resource('');
                this._serviceUrl = uri.toString().slice(0, -1);
                this._componentRegistry.init();
                this._lifecycleChannel = this._eventBus.getChannel(EventBus.CHANNELS.LIFECYCLE);
                this._lifecycleChannel.subscribe('#.success', this._onLifecycleSuccess.bind(this));
                this._lifecycleChannel.subscribe('#.error', this._onLifecycleError.bind(this));

            });
    }

    _loadConfig() {
        let serverConfigFile = new JsonFile(this._configPath);
        return serverConfigFile.loadAsync().then( data => {
            this._config = data;
            Object.freeze(this._config);
            return this._config;
        });
    }


    // caller should catch errors when returned promise failes
    start() {
        // most of these codes should go to HttpService component
        let builder = new RestifyBuilder(this);
        let getServicePort = () => {
            let port = this.serviceUri.port();
            if (port)
                return port;
            switch (this._servcieUri.protocol()) {
                case 'http':
                    return 80;
                case 'https':
                    return 443;
                default:
                    throw new Error('illegal service url in server config : ' + this.serviceUri.toString());
            }
        };

        return builder.buildServerAsync()
                .then( (httpServer) => {
                    let listenAsync = Promise.promisify(httpServer.listen, { context: httpServer });
                    let port = getServicePort();
                    return listenAsync(port).then( () => [httpServer, port]);
                })
                .spread( (httpServer, port) => {
                    this.httpServer = httpServer;
                    debug(`port opened at ${port} - now service starts`);
                    this._logger.info({
                        service: this._serviceUrl,
                        port: port
                    }, 'server started http server for clients');

                    let socketServer = new SocketServer(this);
                    return socketServer.start();
                })
                .then( (socketServer) => {
                    this.socketServer = socketServer;
                    debug(`server started socket server`);
                    this._logger.info('server started web socket server for clients');
                    return this._dispatchLifecycleEvent('start');
                })
                .then( () => {
                    debug(`server started all components, good luck!`);
                    return this;
                })
                .catch( (err) => {
                    this._logger.error({
                        service: this._serviceUrl,
                        err
                    }, 'could not start server');
                    throw err;
                });
        // end of promise chain.
    }

    // pre stop
    stop() {
        if (!this.httpServer)
            return Promise.resolve(this);

        return this._dispatchLifecycleEvent('stop').then( () => {
            debug(`server stopped all components`);
            this.socketServer.stop();
            this.socketServer = null;
            this.httpServer.close();
            this.httpServer = null;
        });
    }

    destroy() {
        return this._dispatchLifecycleEvent('destroy').then( ()=> {
            this._logger.info('server destroyed');
            // TODO: need a way to close all streams now or at process exit
            this._logger = null;
            this._config = null;
            // we cannot change contentsDir & component factory
            // for the values are fixed with constructor.
        });
    }

    _dispatchLifecycleEvent(eventName) {
        let mask = this._componentRegistry.createMask(false);
        this._mask = mask;
        this._lifecyclePromise =
        this._eventBus.getChannel().publish('server.' + eventName);

        let args = new Array(arguments.length);

        // somewhat ugly but arguments.slice() seems to be slow in V8
        for(let i = 1; i < args.length; ++i)
            args[i] = arguments[i]; //

        let components = COMPONENTS;
        if (eventName ==='stop' || eventName === 'destroy') 
            components = COMPONENTS.reverse();
        
        let done = Promise.mapSeries(components, (className) => {
            debug(`dispatching [${eventName}] to ${className}`);
            let instance = this._componentFactory.getComponent(className);
            let method = instance[eventName];
            if (instance && typeof(method) === 'function') {
                return method.call(instance, args);
            } else {
                return Promise.reject(new Error(`${className} has no ${eventName} method`));
            }
        });

        return done.then( () => {
            debug(`dispatched [${eventName}] to all components`);
            return this;
        }).catch( (err) => {
            debug( {err}, `dispatching [${eventName}] failed `);
            // now, complex thing - when something goes wrong
            // if init()    fails... server should be constructed again, without destroy 
            //                       or process should be restarted 
            // if start()   fails... any component started well, should ignore repeated start()
            // if stop()    fails... component should be able to start again.  
            // if destroy() fails... just ignore 
            if (eventName !== 'destroy')            
                throw err;
        });
    }
}


module.exports = WebidaServer;