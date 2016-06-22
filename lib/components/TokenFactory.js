/**
 * Created by lunaris on 2016-05-25.
 */
'use strict';

const { restify } = __webida.libs;

const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const shortid = require('shortid');
const Token = require('../api/models/Token.js');
const AbstractComponent = require('./AbstractComponent.js');

const TOKEN_VERIFY_OPTIONS = {
    clockTolerance : 30
};

// token factory does not remember what he created, for token is not a session
//  api key should be handled differently 

class TokenFactory extends AbstractComponent {

    constructor(server) {
        super('token-factory', [], server);
    }

    init() {
        this._secret = this._server.config.tokenSecret;
    }

    // Token model is diffent from encoded jwt
    // look code carefully

    createMasterTokenAsync(duration, workspaceId) {
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
    createAccessTokenAsync(sourceToken, duration) {
        let payload = {
            type: 'A',
            sessionId: sourceToken.sessionId || shortid(),
            workspaceId: sourceToken.workspaceId
        };
        return this._createAsync(payload, duration || 600);
    }

    _createAsync(payload, duration) {

        let text; 
        let ret = jwt.signAsync(payload, this._secret, {
            jwtid: shortid(),
            expiresIn : duration || 600
        }).then( signed => {
            text = signed;
            return jwt.decode(signed);
        }).then( decoded => {
            return new Token(decoded, text);
        });
        
        return ret; 
    }
    
    verifyTokenAsync(tokenText) {
        return jwt.verifyAsync(tokenText, this._secret, TOKEN_VERIFY_OPTIONS)
            .then( decoded => {
                return new Token(decoded, tokenText);
            })
            .catch( err => {
                throw new restify.UnauthorizedError('invalid token', err);
            });
    }
}

module.exports = TokenFactory;