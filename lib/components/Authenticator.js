'use strict';

const restify = require('restify');

// token factory does not remember what he created, for token is not a session
//  api key should be handled differently

// TODO : make methods async.
class Authenticator extends AbstractComponent {

    constructor(server) {
        super('authenticator', [], server);
    }

    authAsync(loginId, loginPassword) {
        if (!this._server.config.loginId ||
            !this._server.config.loginPassword ) {
            const msg = 'server has not configured to login';
            return Promise.reject(new restify.ServiceUnavailableError(msg));
        }

        const result = (
            this._server.config.loginId === loginId &&
            this._server.config.loginPassword === loginPassword
        );
        
        return Promise.resolve(result);
    }
}

module.exports = Authenticator;