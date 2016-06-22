'use strict';

const {path, util, URI, _, debugFactory, restify} = __webida.libs;
const debug = debugFactory(module);

const bunyan = require('bunyan');
// const sockio = require ('socket.io');

const JsonFile = require('./JsonFile.js');
const swaggerize = require('./swaggerize.js');
const ComponentFactory = require('./ComponentFactory.js');

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

const COMPONENTS = [ 'TokenFactory', 'WorkspaceRegistry'];

class WebidaServer {

    constructor() {
        // most properties are accessible from components.
        // instead of adding getters, server just opens the properties

        this.config = null;
        this.logger = null;
        this.serviceUri = null;
        this.serviceUrl = null;

        this.contentsDir = __webida.env.contentsDir ||
            path.resolve(__webida.env.serverRoot,  'contents');

        this._componentFactory = new ComponentFactory(this);
        COMPONENTS.forEach( className => this._componentFactory.createComponent(className) );
        this.app = null;  // restify server instance
    }

    // init will create all helper objects and resolves self when all helpers are initialized
    // init() will not be called twice. should create new instance again
    init() {
        let serverConfigFile = new JsonFile(JsonFile.WEBIDA_SERVER_CONFIG_PATH);
        return serverConfigFile.loadAsync().then( data => {
            if (this.config) {
                throw new Error ('server instance should not be re-initialize after destroy');
            }
            this.config = data;

            // the service Uri always contains path, '/', even config.url has no path part
            // it's better to cut it off for desktop app or client code to build clean url
            this.serviceUri = new URI(this.config.url).resource('');
            this.serviceUrl = this.serviceUri.toString().slice(0, -1);

            // when server destroys, logger should be nullified
            this.logger = bunyan.createLogger(_.cloneDeep(LOGGER_OPTIONS));
            this.logger.info({
                serviceUrl: this.serviceUrl
            }, 'server initialized');

            return this._dispatchLifecycleEvent('init');
        });
        // end of promise chain
    }

    // caller should catch errors when returned promise failes
    start() {
        let initialOptions = {
            name: 'webida-server',
            log: this.logger
        };
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
                this.app = restifyServer;

                // this router should be put after all other routes
                let servDir = path.resolve(this.contentsDir, '..');
                this.app.get(/\/contents\/?(.*)/, restify.serveStatic({
                    directory: servDir,
                    default: 'index.html'
                }));

                let servicePort = this._getServicePort();
                this.app.listen(servicePort, () => {
                    debug('port opened. now service start');
                    this.logger.info({
                        service : this.serviceUrl
                    }, 'server started service for clients');
                });
                return this._dispatchLifecycleEvent('start');
            });
    }

    // pre stop
    stop() {
        return this._dispatchLifecycleEvent('stop').then( ()=> {
            // TODO : should handle socket closing more gracefully
            if(this.app) {
                this.app.close();
                this.app = null;
            }
            this.logger.info('server stopped');
        });
    }

    destroy() {
        return this._dispatchLifecycleEvent('destroy').then( ()=> {
            this.logger.info('server destroyed');
            // we need a way to close all streams now or at process exit
            this.logger = null;
        });
    }

    restart() {
        return this.stop().then( ()=> this.start() );
    }

    _prepareRestifyOptions(initialOptions) {
        switch (this.serviceUri.protocol()) {
            case 'https':
                return this._loadSecureProtocolOptions(initialOptions).then( (restifyOptions) => {
                    if (this.config.useSpdy) {
                        restifyOptions.spdy = this.config.secureProtocolOptions || {};
                    } else {
                        restifyOptions.httpsServerOptions = this.config.secureProtocolOptions || {};
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

    static _loadSecureProtocolOptions(initialOptions) {
        // load ca, key, cert, pfx, crls
        // if pfx presents, ca, key, certs are ignored
        // ignore crl file loading error. (revocation is not so important);
        // TODO : implement this
        return Promise.resolve(initialOptions);
    }


    // start helpers
    _initializeRequestHandlerChain(app) {

        app.use(restify.CORS({
            origins:['*'],
            credentials: true
        }));
        app.use(restify.requestLogger());
        app.use(restify.queryParser());
        app.use(restify.bodyParser({
            // mapFiles: true turning on map file will 
        }));

        app.use( (req, res, next) => {
            let helpers = {};
            // a = b => c looks clean but is really hard to see that b => c is a function
            // so, we prefer to add parentheses for every single argument fat-arrow function
            req.getServerComponent = (className) => this._componentFactory.getComponent(className);
            req.getHelper = (moduleName) => {
                if (!helpers[moduleName]) {
                    helpers[moduleName] = require('./api/helpers/' + moduleName + '.js');
                }
                return helpers[moduleName];
            };
            req.getServerConfig = ( () => this.config );
            return next();
        });

        if (__webida.env.debug || __webida.env.enableAudit) {
            app.on('after', restify.auditLogger({
                log: this.logger,
                body: __webida.env.devmode
            }));
        }

        // pre-defined routers
        // test points for out-of-api service
        app.get('/ping/:fsid/:fsPath(.*)', function pingpong(req, res, next) {
            req.log.info({
                params: req.params
            }, 'got ping!');
            res.json({
                pong: 'pong',
                echo:req.params
            });
            return next();
        });

        // since git-http-backend program is basically a CGI script,
        //  we can't use middleware chain
        // TODO : find a way to support authentication and audit logging

        app.pre( function preHandler(req, res, next) {
            if (!req.url.startsWith('/git/')) {
                // sanitizing req.url for path params usually have encoded parameters
                // although they are handled by router correctly, logs are not clean.
                // Be sure that we do not touch query parameters.
                let old1 = req.url;
                let normalized = new URI(req.url).normalize();
                let pathname = normalized.pathname(true);
                pathname = decodeURIComponent(pathname);
                let new1 = normalized.path(pathname).toString();
                if (old1 !== new1) {
                    req.url = new1;
                    // debug({old1, new1}, 'sanitized request url');
                }
                return next();
            }
            // TODO : separate git request handler from this file
            //  (find a way to get audit logs after handling git http requests)

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
        let port = this.serviceUri.port();
        if (port) {
            return port;
        }
        switch (this._servcieUri.protocol()) {
            case 'http':
                return 80;
            case 'https':
                return 443;
            default:
                throw new Error('illegal service url in server config : ' + this.serviceUri.toString());
        }
    }

    _dispatchLifecycleEvent(eventName) {
        let args = new Array(arguments.length);
        for(let i = 1; i < args.length; ++i) { // somewhat ugly but arguments.slice() seems slow in V8
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