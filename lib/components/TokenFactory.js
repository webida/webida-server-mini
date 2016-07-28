/**
 * Created by lunaris on 2016-05-25.
 */
'use strict';

const { restify,  _ } = __webida.libs;

const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const shortid = require('shortid');
const Token = require('http-service-libs/models/Token.js');
const AbstractComponent = require('./../AbstractComponent.js');

const TOKEN_VERIFY_OPTIONS = {
    clockTolerance : 30
};

const DEFAULT_ACCESS_TOKEN_DURATION = 900; 

// token factory does not remember what he created, for token is not a session-registry
//  api key should be handled differently 

class TokenFactory extends AbstractComponent {

    constructor(server) {
        super('token-factory', [], server);
    }

    init() {
        return super.init().then( () => {
            this._secret = this._server.config.tokenSecret;
        });
    }

    // Token model is diffent from encoded jwt
    // look code carefully

    createMasterTokenAsync(workspaceId, duration) {
        // When workspaceId is empty string or some other falsy value
        //  we should set 'undefined' value to ensure that generated token text
        //  is same to the object without 'workspaceId' propety

        let payload = {
            type: 'M',
            workspaceId : workspaceId || undefined 
        };
        return this._createAsync(payload, duration);
    }

    // source token is current access token or empty object we need no verification
    createAccessTokenAsync(sourceToken, workspaceId, duration) {
        let payload = {
            type: 'A',
            sessionId: sourceToken.sessionId || shortid(),
            workspaceId: workspaceId || sourceToken.workspaceId
        };
        return this._createAsync(payload, duration || DEFAULT_ACCESS_TOKEN_DURATION);
    }

    _createAsync(payload, duration) {
        return jwt.signAsync(payload, this._secret, {
            jwtid: shortid(),
            expiresIn : duration
        }).then( signed => {
            let decoded = jwt.decode(signed);
            return new Token(decoded, signed);
        });
    }

    _checkAccessRange(token, accessTo) {
        return _.every(accessTo, (value, key) => {
            let tokenValue = token[key];
            if (tokenValue) {
                return tokenValue === value || 
                    (_.isArray(tokenValue) && tokenValue.indexof(value) >= 0); 
            } else {
                return true; 
            }
        });
    }

    // verify token & check access range of token
    //  if token.workspaceId is not falsy, accessTo.workspaceId should be same
    verifyTokenAsync(tokenText, accessTo) {
        return jwt.verifyAsync(tokenText, this._secret, TOKEN_VERIFY_OPTIONS)
            .then( decoded => {
                let token = new Token(decoded, tokenText);
                let hasRight = this._checkAccessRange(token, accessTo || {});
                if (hasRight) {
                    return token;
                } else {
                    throw new restify.ForbiddenError('token has no access right');
                }
            });
            // }, (err) => {
            //     throw new restify.UnauthorizedError('invalid token', err);
            // });
    }
}

module.exports = TokenFactory;