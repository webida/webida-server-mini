'use strict';
const { URI } = __webida.libs;

const RestifyBuilder = require('./http-service/RestifyBuilder.js');
const AbstractComponent = require('./../AbstractComponent.js');

class HttpService extends AbstractComponent {

    constructor(logger, eventBus, config) {
        super(logger, eventBus, {
            start:['session-registry', 'workspace-registry', 'alias-registry',
                'authenticator', 'authorizer', 'token-factory']
        });
        this._httpServer = null;
        this._serviceUrl = null;
        this._port = -1;
        this._config = config;
    }

    get httpServer() {
        return this._httpServer;
    }

    get serviceUrl() {
        return this._serviceUrl;
    }

    init() {
        return super.init()
            .then( () => {
                let uri = new URI(this._config.url).resource('');
                this._serviceUrl = uri.toString().slice(0, -1);
                this._port = HttpService._getServicePort(uri);
                let builder = new RestifyBuilder(this._config, this.logger, this.lookupComponent);
                return builder.buildAsync();
            })
            .then( httpServer => {
                this._httpServer = httpServer;
            });
    }

    start() {
        return super.start()
            .then( () => {
                let httpServer = this._httpServer;
                let listenAsync = Promise.promisify(httpServer.listen, { context: httpServer });
                return listenAsync(this._port);
            });
    }

    stop() {
        this._httpServer.close();
        return Promise.resolve();
    }

    destroy() {
        this._httpServer = null;
        this._serviceUrl = null;
    }

    static _getServicePort(uri) {
        let port = uri.port();
        if (port)
            return port;
        switch (uri.protocol()) {
            case 'http':
                return 80;
            case 'https':
                return 443;
            default:
                throw new Error('illegal service url in server config : ' + uri.toString());
        }
    }
}

module.exports = HttpService;
