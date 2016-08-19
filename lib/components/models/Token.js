'use strict';
const ApiTokenModel = require('webida-restful-api').Token;

const TokenTypeMap = {
    M: ApiTokenModel.TokenTypeEnum.MASTER,
    A: ApiTokenModel.TokenTypeEnum.ACCESS
};

class Token extends ApiTokenModel {
    // see TokenFactory.js and json web token documents for details of each properties
    constructor(jwtObject, text) {
        // sets text, type, expiresAt, issuedAt
        // since jwt saves time as unix time stamp (without msec), we should multiply 1000
        super(text, TokenTypeMap[jwtObject.type],
            new Date(jwtObject.exp * 1000), new Date(jwtObject.iat * 1000)
        );
        this.workspaceId = jwtObject.workspaceId;
        this.sessionId = jwtObject.sessionId;
    }
}

module.exports = Token;