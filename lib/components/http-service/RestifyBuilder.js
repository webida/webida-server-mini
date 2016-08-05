'use strict';

const { restify, debugFactory, fsx, path, URI } = __webida.libs;
const debug = debugFactory(module);
const specObject = require('webida-restful-api/api-spec/swagger.json');
const swaggerize = require ('./swaggerize.js');
const gitHandler = require('./git-handler.js');

class RestifyBuilder {

    constructor(config, logger, lookupComponent) {
        this._config = config;
        this._options = {
            name : 'webida-server', 
            log : logger
        };
        this._lookupComponent = lookupComponent
        this._restifyServer = null;
    }
    
    // returns a restify server (is a sub class of node.js http server) 
    // with properly configured, with
    buildAsync() {
        return this._prepareOptions()
            .then( (options) => {
                this._restifyServer = restify.createServer(this._options);
                this._setPrewares();
                this._setMiddlewares();
                this._setDefaultRoutes();
                return swaggerize(this._restifyServer, {
                    basedir : path.resolve(__dirname),
                    api: specObject,
                    docsPath: 'swagger'
                });
            });
    }

    _prepareOptions() {
        let config = this._config;
        let protocol = new URI(config.url).protocol();
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
                throw new Error('invalid server url in configuration ' + this._serviceUrl);
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
                gitHandler(this.lookupComponent, req, res, next);
                // git handler calls next() in error case only
                // so, normal git requests will not be processed in request pipe lines
                // and they will not be logged with audit logger.
                // gitHandler should log meaningful info/error level logs, by self.
                // (e.g. we don't want to log every 401 error for http auth)
            }
        }

        this._restifyServer.pre( sanitizeUrl, handleGitRequest );
    }

    _setMiddlewares() {
        let app = this._restifyServer;
        let serverLogger = this._options.log;
        app.use(restify.CORS({
            origins:['*'],
            credentials: true,
            headers: ['last-modified', 'etag']
        }));

        // restify bug - cannot control 'allowed headers' of OPTION request directly.
        // so, we should 'hack' the constants for routers

        restify.CORS.ALLOW_HEADERS.push('authorization');
        restify.CORS.ALLOW_HEADERS.push('if-modified-since');
        restify.CORS.ALLOW_HEADERS.push('if-none-match');

        app.use(restify.requestLogger());
        app.use(restify.queryParser());

        // should not use 'mapFiles' option
        //  for reading whole file contents into memory is not desirable.
        //  TODO : add tmp directory from config
        app.use(restify.bodyParser({
            overrideParams: true,
            // we may have to set some upload limit, 'maxBodySize'
            uploadDir : this._config.tmpdir || __webida.env.tmpdir
        }));
        
        // should not use anonoymous funciton ( =>, too)
        function injector(req, res, next) {
            req.getServerComponent = this._lookupComponent;
            req.getServerConfig = () => this._config;
            next();
        }

        app.use(injector);
        
        if (__webida.env.debug || __webida.env.enableAudit) {
            app.on('after', restify.auditLogger({
                log: serverLogger,
                body: __webida.env.devmode
            }));
        }
    }

    _setDefaultRoutes() {
        let app = this._restifyServer;
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
        let servDir = path.resolve(this._config.contentsDirPath, '..');
        app.get(/^\/contents\/?(.*)/, restify.serveStatic({
            directory: servDir,
            default: 'index.html'
        }));

        // TODO : add 'top' level handler to handle '/'
        //  - redirect to contents/dashboard/index.html
    }
}


module.exports = RestifyBuilder;

