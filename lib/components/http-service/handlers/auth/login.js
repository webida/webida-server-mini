'use strict';

const { restify } = __webida.libs;
const helper = require('../../helper.js')(module);

function login(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    
    try {
        let tokenFactory = req.getServerComponent('token-factory');
        let authenticator = req.getServerComponent('authenticator');

        req.log.debug('login params', req.params);

        let createAccessToken = () => {
            let masterTokenText = req.params.masterToken;
            if (masterTokenText) {
                return authenticator.authToken(masterTokenText)
                    .then(masterToken => tokenFactory.createAccessTokenAsync(masterToken));
            } else {
                let loginId = req.params.loginId;
                let loginPassword = req.params.loginPassword;
                return authenticator.authByCredential(loginId, loginPassword)
                    .then((authResult) => {
                        if (!authResult)
                            throw new restify.UnauthorizedError('authentication failed');
                        else
                            return tokenFactory.createAccessTokenAsync({});
                    });
            }
        };

        let sendResponse = (accessToken, fromCredential) => {
            let msg = fromCredential ? 'new access token from credential' :
                'spawned access token from master token';
            req.log.info( { accessToken }, msg );
            finish(accessToken);
        };

        createAccessToken()
            .then( accessToken => sendResponse(accessToken) )
            .catch( err => finish(err) );
        // end of promise chain

    } catch (err) {
        return next(err);
    }
}

module.exports = {
    post : login
};