'use strict';

const {path, URI, _, debugFactory} = __webida.libs;
const debug = debugFactory(module);

const bunyan = require('bunyan');

const Deferred = require('./Deferred.js');
const EventBus = require('./EventBus.js');
const JsonFile = require('./JsonFile.js');
const ComponentRegistry = require('./ComponentRegistry.js');
const homeManager = require('./init/home-manager.js');

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
        this._contentsDirPath = contentsDirPath || __webida.env.contentsDir ||
            path.resolve(__webida.env.serverRoot, 'contents');
        this._logger = WebidaServer._createLogger(logSuffix);
        this._eventBus = new EventBus(this._logger);
        this._componentRegistry = new ComponentRegistry(this._eventBus, this._logger);

        // following properties will be set in init() phase
        this._config = null;
        this._serviceUrl = null;
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
        return this._initSelf().then( ()=> {
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
                // TODO: Configuration need to be extracted to a component,
                //  for other components can subscribe config change event easily.
                this._config = config;
                this._componentRegistry.init(config);
                let channel = this._eventBus.getChannel(EventBus.CHANNELS.LIFECYCLE);
                channel.subscribe(this, {
                    '#.success' : this._onLifecycleSuccess,
                    '#.error' : this._onLifecycleError
                }, 'server');
            });
    }

    _loadConfig() {
        let serverConfigFile = new JsonFile(this._configPath);
        return serverConfigFile.loadAsync().then( data => {
            data.contentsDirPath = this._contentsDirPath;
            Object.freeze(data);
            return data;
        });
    }

    // caller should catch errors when returned promise failes
    start() {
        return this._dispatchLifecycleEvent('start').then( () => {
            debug(`server started all components`);
            this._logger.info('server started');
        });
        // end of promise chain.
    }

    // pre stop
    stop() {
        return this._dispatchLifecycleEvent('stop').then( () => {
            debug(`server stopped all components`);
            this._logger.info('server stopped');
        });
    }

    destroy() {
        return this._dispatchLifecycleEvent('destroy').then( ()=> {
            this._logger.info('server destroyed');
            // TODO: need a way to close all streams now or at process exit
            this._logger = null;
            this._config = null;
            this._componentRegistry.destroy();
            this._eventBus.reset();
            // we cannot change contentsDir & component factory
            // for the values are fixed with constructor.
        });
    }

    _dispatchLifecycleEvent(eventName) {
        this._mask = Deferred.createDeferredMap(this._componentRegistry.getComponentIds());

        debug({targets : Object.keys(this._mask)}, 'dispatching server.' + eventName);
        this._eventBus.getChannel(EventBus.CHANNELS.LIFECYCLE).publish('server.' + eventName);

        return Deferred.promiseDeferredMap(this._mask)
            .then( () => {
                debug('server got success from all components for ' + eventName);
                this._logger.info({
                    _serviceUrl: this._serviceUrl,
                    event : eventName
                }, `server ${eventName} done`);
            })
            .catch ( e => {
                debug(e, 'server got error from some components for ' + eventName);
                this._logger.error(e, `server ${eventName} failed`);
                // TODO : define some lifecycle error class wrapping internal errors.
                //  & make all components use the wrapping error class instead of vanilla error.
                // App/launcher may not need to know what exactly happened, in the life-cycle phase.
                // But, at least, they should be able to distinguish some other internal / their
                // own errors from component life-cycle error, although they can do nothing but
                // killing process.
                throw e;
            });
    }

    _onLifecycleSuccess(data, envelope) {
        debug(`server got component event : ${envelope.topic}`);
        let sender = envelope.topic.split('.')[0];
        this._mask[sender].resolve();
    }

    _onLifecycleError(error, envelope) {
        debug(`server got component event : ${envelope.topic}`);
        let sender = envelope.topic.split('.')[0];
        error.sender = sender;
        this._mask[sender].reject(error);
    }
}


module.exports = WebidaServer;