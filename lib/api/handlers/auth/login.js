'use strict';

const restify = require('restify');

// currently don't support login via credential
// only master token will work

function login(req, res, next) {
    next = req.getHelper('next-wrapper')(req, res, next, 'login');
    
    try {
        let masterTokenText = req.params.masterToken;
        let tokenFactory = req.getServerComponent('TokenFactory');

        if (masterTokenText) {
            tokenFactory.verifyTokenAsync(masterTokenText)
                .then( masterToken => tokenFactory.createAccessTokenAsync(masterToken) )
                .then( accessToken => {
                    req.log.info( { accessToken }, 'spawned access token from master');
                    res.send(200, accessToken);
                    next();
                })
                .catch( (error) => {
                    next(error);
                });
            // chained to promise. no need to call next now.
        } else {
            let loginId = req.params.loginId;
            let loginPassword = req.params.loginPassword;
            let authenticator = req.getServerComponent('Authenticator');

            authenticator.authAsync(loginId, loginPassword)
                .then( (authResult) => {
                    if (!authResult)
                        throw new restify.UnauthorizedError('authentication failed');
                    else
                        return tokenFactory.createAccessTokenAsync({});
                })
                .then( (accessToken) => {
                    req.log.info( { accessToken }, 'new access token from credential');
                    res.send(200, accessToken);
                    next();
                })
                .catch( (error) => {
                    next(error);
                });
            // chained to promise. no need to call next now.
        }
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    post : login
};