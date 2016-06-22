'use strict';

const TokenTypeMap = {
    M: 'MASTER',
    A: 'ACCESS'
};

class Token {
    // see TokenFactory.js and json web token documents
    constructor(jwtObject, text) {
        // TODO - need a enum from raw token type
        this.type = TokenTypeMap[jwtObject.type];
        this.issuedAt = new Date(jwtObject.iat * 1000);
        this.expiresAt = new Date(jwtObject.exp * 1000);
        this.workspaceId = jwtObject.workspaceId;
        this.sessionId = jwtObject.sessionId;

        this.text = text;
    }
}


module.exports = Token;