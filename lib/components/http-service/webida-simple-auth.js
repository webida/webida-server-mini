'use strict';

var restify = require('restify');

function webidaSimpleAuthorize(req, res, nextAuthorize) {
    // someday, we will use req.requiredScopes. see swaggerize-routes examples for detail
    try {
        let tokenText = req.headers.authorization;

        if (!tokenText) {
            return nextAuthorize(new restify.UnauthorizedError('need access token'));
        }

        let tokenFactory = req.getServerComponent('TokenFactory');
        return tokenFactory.verifyTokenAsync(tokenText)
            .then( token => {
                if (token.type !== 'ACCESS') {
                    return nextAuthorize(new restify.UnauthorizedError('invalid token type'));
                }
                req.token = token;
                nextAuthorize();
                return null;  // shut up, blue bird.
            })
            .catch( (e) => {
                nextAuthorize(new restify.UnauthorizedError('invalid token', e));
            });
        
        // Detailed authorizations with restricted token should be done in handlers, 
        //  not here, for swaggerize-routes has no parsed/verified parameters yet.
        
    } catch (e) {
        return nextAuthorize(e);
    }
}

module.exports = webidaSimpleAuthorize;
