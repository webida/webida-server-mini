"use strict";

var {path, util, URI, _, debugFactory} = global.process.libs;

var bunyan = require('bunyan');
var restify = require('restify');
var sockio = require ('socket.io');

var JsonFile = require('./JsonFile.js');
var swaggerize = require('./swaggerize.js');
var Workspace = require('./Workspace.js');
var ComponentFactory = require('./ComponentFactory.js');

var debug = debugFactory(module);

const LOGGER_LEVEL_DISABLED = 9999; // funky hack for bunyan to enable/disable logging, keeping same logger instance
const LOGGER_OPTIONS = {
    name: 'server',
    level: 'info',
    streams: [
        {
            type: 'rotating-file',
            path: path.resolve(process.env.WEBIDA_HOME, 'logs', "server.log"),
            period: '1d',
            count: 10
        }
    ]
};
const COMPONENTS = [ 'TokenFactory', 'WorkspaceRegistry'];

class WebidaServer {

    constructor() {
        // all members are private. use public getter
        this._app = null;  // restify servers
        this._config = null;
        this._logger = null; // normal server logger
        this._serviceUri = null; // is URIjs object , not a plain string
        this._serviceUrl = null;

        // TODO : make contents dir configurable
        //  - we need a 'rc' chain for start-up configuration
        this.contentsDir = path.resolve(__dirname, 'contents');
        
        this._componentFactory = new ComponentFactory(this);
        COMPONENTS.forEach( (className) => this._componentFactory.createComponent(className) );
    }

    // while server is not started, logger is not available
    //  for it's not initialized

    get logger() {
        return this._logger;
    }

    get serviceUrl() {
        return this._serviceUrl; // not _serviceUri.toString() for it contains trailing '/' always
    }

    get isRunning() {
        return this._app ? true : false;
    }

    get config() {
        return this._config; 
    }
    
    // init will create all helper objects and resolves self when all helpers are initialized 
    init() {
        let serverConfigFile = new JsonFile(JsonFile.WEBIDA_SERVER_CONFIG_PATH);
        debug('loaded configuration file');
        return serverConfigFile.loadAsync().then( (data) => {
            this._applyServerConfig(data);
            this.logger.info({
                serviceUrl: this.serviceUrl
            }, 'server initialized');
            return this._dispatchLifecycleEvent('init');
        });
    }

    // caller should catch errors when returned promise failes
    start() {
        let initialOptions = {
            name: 'webida-server',
            log: this._logger
        };
        debug('loaded configuration file');
        return this._prepareRestifyOptions(initialOptions)
            .then( (restifyOptions) => {
                debug('restify create options  ' + util.inspect(restifyOptions));
                if (!restifyOptions) {
                    throw new Error('something has gone wrong');
                }
                let restifyServer = restify.createServer(restifyOptions);
                this._initializeRequestHandlerChain(restifyServer);
                return swaggerize(restifyServer, {
                    basedir : path.resolve(__dirname, 'api'),
                    api: path.resolve(__dirname, 'api', 'swagger.yaml'),
                    docspath: 'swagger'
                });
             })
            .then ( (restifyServer) => {
                this._app = restifyServer;
                let servicePort = this._getServicePort();
                this._app.listen(servicePort, () => {
                    // TODO : implement converting logic from this._serviceUrl to swagger host string
                    // let swaggerHostString = this._serviceUri.host() + ':' + servicePort;
                    // this._app.swagger.api.host = swaggerHostString;
                    // this._app.swagger.api.schemes = [ this._serviceUri.protocol() ]
                    debug('port opened. now service start');
                    this.logger.info({
                        service : this.serviceUrl
                    }, 'server started http service for clients');
                });
                // server should start components after starting itself
                // TODO : add logic to close & delete this._app when starting fails
                return this._dispatchLifecycleEvent('start');
            });
    }

    // pre stop
    stop() {
        return this._dispatchLifecycleEvent('stop').then( ()=> {
            // TODO : should handle socket closing more gracefully
            if(this._app) {
                this._app.close();
                this._app = null;
            }
            this.logger.info("server stopped");
        });
    }

    destroy() {
        return this._dispatchLifecycleEvent('destroy').then( ()=> {
            this.logger.info("server destroyed");
        });
    }

    restart() {
        return this.stop().then( ()=> this.start() );
    }

    _applyServerConfig(data) {
        this._config = data;
        this._serviceUri = new URI(this._config.url).resource('');
        this._serviceUrl = this._serviceUri.toString().slice(0, -1);
        debug('detectedc serviceUrl = ' + this._serviceUrl );

        // the service Uri always contains path, '/' even config.url has no
        // so, we have to chop trailing / , when someone access serviceUrl via getter

        let loggingConfig = this._config.logging || {};

        // when debugging mode, logs will be very verbose
        if (process.env.WEBIDA_DEBUG) {
            loggingConfig.disabled = false;
            loggingConfig.level = 'debug';
            loggingConfig.audit = true;
            debug ('forced server log to debug by process.env');
        }
        // adjust server logger option from server log config
        let loggerOptions = _.cloneDeep(LOGGER_OPTIONS);
        if (loggingConfig.disabled) {
            loggerOptions.level = LOGGER_LEVEL_DISABLED;
        } else {
            loggerOptions.level = loggingConfig.level || loggerOptions.level;
        }
        let rotatingOptions = loggingConfig['rotating']|| {};
        let streamOption = loggerOptions.streams[0];
        streamOption.period = rotatingOptions.period || streamOption.period;
        streamOption.count = rotatingOptions.count || streamOption.count;

        debug('logger options = %s', util.inspect(loggerOptions));
        if (this._logger) {
            // should apply new logger options to current logger instance
            // auditing option will be applied when creating new restify server instance
            this._logger.level = loggerOptions.level;
        } else {
            this._logger = bunyan.createLogger(loggerOptions);
        }
    }

    _prepareRestifyOptions(initialOptions) {
        switch (this._serviceUri.protocol()) {
            case 'https':
                return this._loadSecureProtocolOptions(initialOptions).then( (restifyOptions) => {
                    if (this._config.useSpdy) {
                        restifyOptions.spdy = this._config.secureProtocolOptions || {};
                    } else {
                        restifyOptions.httpsServerOptions = this._config.secureProtocolOptions || {};
                    }
                    return restifyOptions;
                });
            case 'http':
                debug('protocol http');
                return Promise.resolve(initialOptions);

            default:
                throw new Error('invalid server url in configuration ' + this.serviceUrl);
        }
    }

    _loadSecureProtocolOptions(initialOptions) {
        // load ca, key, cert, pfx, crls
        // if pfx presents, ca, key, certs are ignored
        // ignore crl file loading error. (revokation is not so importnt);

        return Promise.resolve(initialOptions);
    }


    // start helpers
    _initializeRequestHandlerChain(app) {

        app.use(restify.CORS({
            origins: ['*'],
            headers: ['authorization']
        }));

        app.use(restify.requestLogger());
        app.use(restify.queryParser());
        app.use(restify.bodyParser({
            // mapFiles: true turning on map file will 
        }));

        app.use( (req, res, next) => {
            req.getServerComponent = (className) => this._componentFactory.getComponent(className);
            req.getHelper = (moduleName) => require('./api/helpers/' + moduleName + '.js');
            return next();
        });

        if (this._config.logging && this._config.logging.audit) {
            debug('adding audit logger');
            app.on('after', restify.auditLogger({
                log: this._logger
            }));
        }

        // pre-defined routers
        // test points for out-of-api service
        app.get('/ping/:fsid/:fsPath(.*)', function pingpong(req, res, next) {
            req.log.info({
                params: req.params
            }, "got ping!");
            res.json({
                pong: 'pong',
                echo:req.params
            });
            return next();
        });

        app.get('/contents/:anypath' , restify.serveStatic({
            directory: this.contentsDir,
            default: 'index.html'
        }));

        // since git-http-backend program is basically a CGI script,
        //  we can't use middleware chain
        // TODO : find a way to support authentication and audit logging

        app.pre( function gitHandler(req, res, next) {
            if (!req.url.startsWith('/git/')) {
                return next();
            }
            
            //
            // repository path == xxx/some/dir/repository/name
            //
            // remote git client has cloned the repository as
            //  http://${host}/git/:workspaceId/:repositoryPath
            // and send http request to
            //    http://${host}/git/:workspaceId/:repositoryPath/info/refs?service= ...
            //    http://${host}/git/:workspaceId/:repositoryPath/git-receive-pack
            //    http://${host}/git/:workspaceId/:repositoryPath/git-upload-pack
            //

            // how to implement
            // step 1 : parse req.url
            // step 2 : build backend service driver with gitHttpBackend();
            // step 3 : build pipeline to handle http auth
            // step 4 : activate pipeline
            // step 5 : when pipeline detects authenticated request,
            //          spawn service process, child with exit handler
            // step 6 : pipe child.stdout to res
            //          write buffered header to child.in
            //          pipe req to child.stdin
            // step 7 : invoke 'end' event or 'after' event for audit logger
            //

            // let gitHttpBackend = require('git-http-backend');
            // let spawn = require('child_process.spawn');
            // let { workspaceId, repositryPath} = parseGitHttpRequest(req.url);
            // let wsr = this._componentFactory.getComponent('WorkspaceRegistry');
            // let ws = wsr.getWorkspace(workspaceId);
            // if (!ws) {
            //     return next(new restify.NotFoundError("no such workspace " + wsid));
            // }
            // this.logger.debug ({
            //     wsid: ws.id,
            //     repoPath: repositoryPath,
            //     wsPath: ws.workspacePath
            // }, 'git service start %s/%s');
        });

    }

    _getServicePort() {
        let port = this._serviceUri.port();
        if (port) {
            return port;
        }
        switch (this._servcieUri.protocol()) {
            case 'http':
                return 80;
            case 'https':
                return 443;
            default:
                throw new Error('illegal service url in server config : ' + this._serviceUri.toString());
        }
    }

    _dispatchLifecycleEvent(eventName) {
        let args = new Array(arguments.length);
        for(var i = 1; i < args.length; ++i) { // somewhat ugly but arguments.slice() seems slow in V8
            args[i] = arguments[i]; //
        }
        let promises = COMPONENTS.map( (className) => {
            let instance = this._componentFactory.getComponent(className);
            let method = instance[eventName];
            if (instance && typeof(method) === 'function') {
                return method.call(instance, args);
            } else {
                return Promise.reject(new Error(`className has no ${eventName} method`));
            }
        });
        return Promise.all(promises).then( () => this );
    }
}


module.exports = WebidaServer;