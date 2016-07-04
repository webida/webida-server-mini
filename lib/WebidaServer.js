'use strict';

const {path, URI, _, debugFactory} = __webida.libs;
const debug = debugFactory(module);

const bunyan = require('bunyan');

const JsonFile = require('./JsonFile.js');
const ComponentFactory = require('./ComponentFactory.js');
const RestifyBuilder = require('./RestifyBuilder.js');
const SocketServer = require('./SocketServer.js');

// To have concurrent, mulitiple instances of server,
// env.disableLogRotate should be truthy,
// for rotating same file multiple times can be a disaster

const LOGGER_OPTIONS = {
    name: 'server',
    level: __webida.env.debug ? 'debug' : (__webida.env.logLevel || 'info') ,
    streams: [{
        type: __webida.env.disableLogRorate ? 'file' : 'rotating-file',
        path: __webida.env.logPath || path.resolve(__webida.env.serverHome, 'logs', 'server.log'),
        period: __webida.env.logRotatingPeriod || '1d',
        count: __webida.env.logRotatingCount * 1 || 5
    }]
};

const COMPONENTS = [ 'TokenFactory', 'WorkspaceRegistry', 'SessionRegistry', 'Authenticator' ];

class WebidaServer {

    constructor() {
        // most properties are accessible from components.
        // TODO : do not allow change of this values by other classes
        //        expose only getters

        this.config = null;
        this.logger = null;
        this.serviceUri = null;
        this.serviceUrl = null;
        this.httpServer = null;  // restify server instance, will be created in init() phase
        this.socketServer = null; // wrapped socket.io server, will be created after http server

        this.contentsDir = __webida.env.contentsDir ||
            path.resolve(__webida.env.serverRoot,  'contents');

        this._componentFactory = new ComponentFactory(this);
        COMPONENTS.forEach( className => this._componentFactory.createComponent(className) );
    }

    getComponent(className) {
        return this._componentFactory.getComponent(className);
    }

    // init will create all helper objects and resolves self when all helpers are initialized
    init() {
        let serverConfigFile = new JsonFile(JsonFile.WEBIDA_SERVER_CONFIG_PATH);
        return serverConfigFile.loadAsync().then( data => {
            this.config = data;

            // the service Uri always contains path, '/', even config.url has no path part
            // it's better to cut it off for desktop app or client code to build clean url
            this.serviceUri = new URI(this.config.url).resource('');
            this.serviceUrl = this.serviceUri.toString().slice(0, -1);

            // when server destroys, logger should be nullified with closing.
            //  afaik, there's no way to close log streams directly
            //  and we should use process exit handler

            this.logger = bunyan.createLogger(_.cloneDeep(LOGGER_OPTIONS));
            debug({ serviceUrl: this.serviceUrl }, 'server initialized self');

            return this._dispatchLifecycleEvent('init').then( () => {
                this.logger.info({ serviceUrl: this.serviceUrl }, 'server initialized');
                return this;
            });
        });
    }

    // caller should catch errors when returned promise failes
    start() {
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
                    this.logger.info({
                        service: this.serviceUrl,
                        port: port
                    }, 'server started http server for clients');

                    let socketServer = new SocketServer(this);
                    return socketServer.start();
                })
                .then( (socketServer) => {
                    this.socketServer = socketServer;
                    debug(`server started socket server`);
                    this.logger.info('server started web socket server for clients');
                    return this._dispatchLifecycleEvent('start');
                })
                .then( () => {
                    debug(`server started all components, good luck!`);
                    return this;
                })
                .catch( (err) => {
                    this.logger.error({
                        service: this.serviceUrl,
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
            this.logger.info('server destroyed');
            // TODO: need a way to close all streams now or at process exit
            this.logger = null;
            this.config = null;
            // we cannot change contentsDir & component factory
            // for the values are fixed with constructor.
        });
    }

    _dispatchLifecycleEvent(eventName) {
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