"use strict";

var restify = require('restify');

function webidaSimpleAuthorize(req, res, nextAuthorize) {
    // someday, we will use req.requiredScopes 
    //  see swaggerize-routes examples for detail
    try {
        let tokenEncrypted = req.headers.authorization;
        if (!tokenEncrypted) {
            return nextAuthorize(new restify.UnauthorizedError('need access token'));
        }
        let tokenFactory = req.getServerComponent('TokenFactory');
        req.token = tokenFactory.verifyAccessToken(tokenEncrypted);
        return nextAuthorize();
    } catch (e) {
        return nextAuthorize(e);
    }
}

module.exports = webidaSimpleAuthorize;
