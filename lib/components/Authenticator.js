'use strict';

const { _, restify } = __webida.libs;
const jwt = Promise.promisifyAll(require('jsonwebtoken'));

const Token = require('./models/Token.js');
const AbstractComponent = require('./../AbstractComponent.js');

const TOKEN_VERIFY_OPTIONS = {
    clockTolerance : 30
};

class Authenticator extends AbstractComponent {

    constructor(logger, eventBus, config) {
        super(logger, eventBus, {
            stop: ['http-service']
        });

        this._tokenSecret = config.tokenSecret;
        this._loginId = config.loginId;
        this._loginPassword = config.loginPassword;
    }
    
    authByCredential(loginId, loginPassword) {
        if (!this._loginId || !this._loginPassword ) {
            const msg = 'server has not configured to login';
            return Promise.reject(new restify.ServiceUnavailableError(msg));
        }
        const result = (this._loginId === loginId && this._loginPassword === loginPassword);
        return Promise.resolve(result);
    }

    // returns true : next() is not called, handler can proceed handling
    authHttpBasic(req, res, next) {
        let authHeader = req.headers.authorization;
        if (!authHeader) {
            // realm name can be fixed - see https://tools.ietf.org/html/rfc2617#page-3
            res.setHeader('WWW-Authenticate', 'Basic realm="webida"');
            next(new restify.UnauthorizedError('Unauthorized'));
            return false;
        }
        try {
            let cred = Authenticator._parseHttpAuthorizationHeader(authHeader);
            if (cred.username !== this._loginId ||
                cred.password !== this._loginPassword) {
                req.log.error(cred, 'invalid http auth credential');
                next(new restify.UnauthorizedError('invalid credential'));
                return false;
            }
        } catch(e) {
            req.log.error(e, 'invalid http auth header');
            return false;
        }
        return true;
    }


    // authToken just checks token is 'properly signed'
    //  we don't provide any further security nor keep persistence of created token
    //  pretty simple, but webida-simple-auth does not require more features.
    authToken(tokenText, accessTo) {
        return jwt.verifyAsync(tokenText, this._tokenSecret, TOKEN_VERIFY_OPTIONS)
            .then( decoded => {
                let token = new Token(decoded, tokenText);
                this.logger.debug(token, 'created token object');
                return token;
            })
            .catch( err => {
                throw new restify.UnauthorizedError('invalid token', err);
            });
    }

    static _parseHttpAuthorizationHeader(headerValue) {
        let pieces = headerValue.split(' ', 2);
        let encoded = pieces[1];
        let decoded;
        let index;

        decoded = (new Buffer(encoded, 'base64')).toString('utf8');
        if (!decoded) {
            throw new restify.UnauthorizedError('invalid authorization header');
        }

        index = decoded.indexOf(':');
        if (index === -1) {
            pieces = [decoded];
        } else {
            pieces = [decoded.slice(0, index), decoded.slice(index + 1)];
        }

        if (!pieces || typeof (pieces[0]) !== 'string') {
            throw restify.UnauthorizedError('invalid authorization header');
        }

        // allows anonymous authentication
        if (!pieces[0]) {
            pieces[0] = null;
        }

        // Allows for passwordless authentication
        if (!pieces[1]) {
            pieces[1] = null;
        }

        return ({
            username: pieces[0],
            password: pieces[1]
        });
    }
}

module.exports = Authenticator;