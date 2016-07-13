'use strict';

const { restify, debugFactory, fsx, path, URI } = __webida.libs;
const debug = debugFactory(module);
const specObject = require('webida-restful-api/api-spec/swagger.json');
const swaggerize = require ('./swaggerize.js');
const gitHandler = require('./git-handler.js');

class RestifyBuilder {

    constructor(server, name) {
        this._server = server;
        this._options = {
            name : name || 'webida-server', 
            log : server.logger
        };
        this._app = null;
    }
    
    // returns a restify server (is a sub class of node.js http server) 
    // with properly configured, with
    buildServerAsync() {
        return this._prepareOptions()
            .then( (options) => {
                this._app = restify.createServer(this._options);
                this._setPrewares();
                this._setMiddlewares();
                this._setDefaultRoutes();
                return swaggerize(this._app, {
                    basedir : path.resolve(__dirname, 'api'),
                    api: specObject,
                    docsPath: 'swagger'
                });
            });
    }

    _prepareOptions() {
        let protocol = this._server.serviceUri.protocol();
        let config = this._server.config;

        switch (protocol) {
            case 'https':
                return this._loadCerts(config.secureProtocolOptions)
                    .then( (optionsWithCerts) => {
                        let prop = config.useSpdy ? 'spdy' : 'httpsServerOptions';
                        this._options[prop] = optionsWithCerts;
                    });
            case 'http':
                return Promise.resolve();
            default:
                throw new Error('invalid server url in configuration ' + this.serviceUrl);
        }
    }

    _loadCerts(secureProtocolOptions) {
        let loadFile = (prop, isBinary) => {
            let filePath = secureProtocolOptions[prop];
            if (filePath) {
                filePath = path.resolve(__webida.env.serverHome, filePath);
                return (
                    fsx.readFileAsync(filePath, {
                        encoding: isBinary ? null : 'utf-8'                   
                    })
                    .then( loaded => {
                        debug({ type:prop, path:filePath }, 'loaded secure option file ');
                        secureProtocolOptions[prop] = loaded;
                    })
                );
            } else {
                debug(`secure protocol option ${prop} not found`);
                return Promise.resolve();
            }
        };

        return Promise.map([
                loadFile('pfx', true),
                loadFile('cert'),
                loadFile('ca'),
                loadFile('key')
            ]).then( () => secureProtocolOptions );
    }

    _setPrewares() {
        let server = this._server;

        function sanitizeUrl(req, res, next) {
            let old1 = req.url;
            let normalized = new URI(req.url).normalize();
            let pathname = normalized.pathname(true);
            pathname = decodeURIComponent(pathname);
            let new1 = normalized.path(pathname).toString();
            if (old1 !== new1) {
                req.url = new1;
                // debug({old1, new1}, 'sanitized request url');
            }
            next();
        }

        function handleGitRequest(req, res, next) {
            if (!req.url.startsWith('/git/')) {
                next();
            } else {
                gitHandler(server, req, res, next);
                // git handler calls next() in error case only
                // so, normal git requests will not be processed in request pipe lines
                // and they will not be logged with audit logger.
                // gitHandler should log meaningful info/error level logs, by self.
                // (e.g. we don't want to log every 401 error for http auth)
            }
        }

        this._app.pre( sanitizeUrl, handleGitRequest );
    }

    _setMiddlewares() {
        let app = this._app;
        let server = this._server;

        app.use(restify.CORS({
            origins:['*'],
            credentials: true
        }));

        app.use(restify.requestLogger());
        app.use(restify.queryParser());

        // should not use 'mapFiles' option
        //  for reading whole file contents into memory is not desirable.
        //  TODO : add tmp directory from config
        app.use(restify.bodyParser({
            overrideParams: true,
            // we may have to set some upload limit, 'maxBodySize'
            uploadDir : server.config.tmpdir || __webida.env.tmpdir
        }));
        
        // should not use anonoymous funciton ( =>, too) 
        //  to print handler names in audit logger.

        function injector(req, res, next) {
            req.getServerComponent = (className) => server.getComponent(className);
            req.getServerConfig = () => server.config;
            let helpers = {};
            req.getHelper = (helperModuleName) => {
                if (!helpers[helperModuleName]) {
                    helpers[helperModuleName] = require('./api/helpers/' + helperModuleName + '.js');
                }
                return helpers[helperModuleName];
            };
            next();
        }

        app.use(injector);
        
        if (__webida.env.debug || __webida.env.enableAudit) {
            app.on('after', restify.auditLogger({
                log: server.logger,
                body: __webida.env.devmode
            }));
        }
    }

    _setDefaultRoutes() {
        let app = this._app;
        let server = this._server; 

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
        
        // contents service
        let servDir = path.resolve(server.contentsDir, '..');
        app.get(/^\/contents\/?(.*)/, restify.serveStatic({
            directory: servDir,
            default: 'index.html'
        }));

        // TODO : add 'top' level handler to handle '/'
        //  - redirect to contents/dashboard/index.html
    }
}


module.exports = RestifyBuilder;

