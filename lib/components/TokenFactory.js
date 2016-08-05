/**
 * Created by lunaris on 2016-05-25.
 */
'use strict';

const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const shortid = require('shortid');
const ApiTokenModel = require('webida-restful-api').Token;
const AbstractComponent = require('./../AbstractComponent.js');

const DEFAULT_ACCESS_TOKEN_DURATION = 900;
const TOKEN_TYPE_MAP = {
    M: ApiTokenModel.TokenTypeEnum.MASTER,
    A: ApiTokenModel.TokenTypeEnum.ACCESS
};

// token factory does not remember what he created, for token is not a session-registry
//  api key should be handled differently 

class TokenFactory extends AbstractComponent {

    constructor(logger, eventBus, config) {
        super(logger, eventBus, {
            stop: ['http-service', 'socket-service']
        });
        this._tokenSecret = config.tokenSecret;
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
        return this._createTokenAsync(payload, duration);
    }

    // source token is current access token or empty object we need no verification
    createAccessTokenAsync(sourceToken, workspaceId, duration) {
        let payload = {
            type: 'A',
            sessionId: sourceToken.sessionId || shortid(),
            workspaceId: workspaceId || sourceToken.workspaceId
        };
        return this._createTokenAsync(payload, duration || DEFAULT_ACCESS_TOKEN_DURATION);
    }

    _createTokenAsync(payload, duration) {
        return jwt.signAsync(payload, this._tokenSecret, {
            jwtid: shortid(),
            expiresIn : duration
        }).then(signed => TokenFactory._createTokenModel(signed, jwt.decoded(signed)));
    }

    // TODO: fix ApiTokenModel to have session id, mandatory
    static _createTokenModel(text, decoded) {
        let token = new ApiTokenModel(text, TOKEN_TYPE_MAP[decoded.type],
            new Date(decoded.exp * 1000), new Date(decoded.iat * 1000)
        );
        token.workspaceId = decoded.workspaceId;
        token.sessionId = decoded.sessionId;
        return token;
    }
}

module.exports = TokenFactory;