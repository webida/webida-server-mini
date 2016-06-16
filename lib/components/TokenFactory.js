/**
 * Created by lunaris on 2016-05-25.
 */
"use strict";

var { _, debugFactory }  = global.process.libs;

var jwt = require('jsonwebtoken');
var uuid = require('node-uuid');
var restify = require('restify');

var debug = debugFactory(module);
var AbstractComponent = require('./AbstractComponent.js');

const TOKEN_DECODING_OPTIONS = {
    clockTolerance : 30
};

class TokenFactory extends AbstractComponent {

    constructor(server) {
        super('token-factory', [], server);
        // TODO : make _secret unenumerable and read-donly
        this._secret = null;
        this._disposables = {};
    }

    start() {
        let newSecret = this._server.config.tokenSecret;
        if ( !this._secret) {
            this._secret = newSecret;
            debug('applies new token secret ' + newSecret);
        } else {
            debug('ignores token secret from config ' + newSecret);
            if ( this._secret != newSecret ) {
                this._server.logger.warn('changing token secret requires whole process restart');
            }
        }
        return this._secret ? Promise.resolve()
            : Promise.reject(new Error('invalid server config - no token secret'));
    }

    createMasterToken(userId, workspaceId, disposable, duration) {
        let masterTokenId = uuid.v4();
        let masterTokenData = {
            userId,
            workspaceId,
            disposable : disposable ? true : false
        };

        let disposableTokenExpiry = process.env.WEBIDA_DEVMODE ? 3600 : 30;
        let longDurationTokenExpiry = duration || 60*60*24*365;
        let masterToken = this._create(masterTokenData, {
            expiresIn : disposable ? disposableTokenExpiry : longDurationTokenExpiry,
            jwtid : masterTokenId
        });
        if (disposable) {
            this._disposables[masterTokenId] = masterTokenData;
        } 
        return masterToken;
    }
    
    createAccessToken (masterToken) {
        let masterTokenData = null;
        try {
            masterTokenData = this._verify(masterToken);
        } catch (e) {
            throw new restify.UnauthorizedError('master token is expired or corrupted');
        }
        debug('master token data ' + JSON.stringify(masterTokenData));

        if (masterTokenData.disposable) {
            let tokenId = masterTokenData.jti;
            if (!this._disposables[tokenId] && !process.env.WEBIDA_DEVMODE ) {
                throw new restify.UnauthorizedError('master token is stale, used already');
            } else {
                delete this._disposables[tokenId];
            }
            // in dev mode, master token lives a little bit long
            // and disposable tokens will not be removed from registry
            // so, don't open ide too much.
        }

        let accessTokenId = uuid.v4();
        let accessTokenData = {
            userId: masterTokenData.userId,
            workspaceId: masterTokenData.workspaceId,
            sessionId: accessTokenId
        };

        return {
            signed: this._create(accessTokenData, { jwtid: accessTokenId }),
            unsigned: accessTokenData
        };
    }

    // we may need async version, later
    //  for decrypting token is a CPU-intensive job, in fact. 
    verifyAccessToken(accessToken) {
        try {
            return this._verify(accessToken);
        } catch (e) {
            throw new restify.UnauthorizedError('invalid access token');
        }
    }

    // see https://github.com/auth0/node-jsonwebtoken for options
    _create (data, options) {
        let defaults = {
            jwtid: uuid.v4(),
            expiresIn: 86400
        };
        let opts = _.merge({}, defaults, options);
        return jwt.sign(data, this._secret, opts);
    }

    // see https://github.com/auth0/node-jsonwebtoken for options
    _verify(token) {
        return jwt.verify(token, this._secret, TOKEN_DECODING_OPTIONS);
    }
}

module.exports = TokenFactory;