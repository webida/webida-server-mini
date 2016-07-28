'use strict';

const { restify } = __webida.libs;
const helper = require('../../helper.js')(module);

function login(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    
    try {
        let masterTokenText = req.params.masterToken;
        let tokenFactory = req.getServerComponent('TokenFactory');

        req.log.debug('login params', req.params);

        let createAccessToken = () => {
            if (masterTokenText) {
                return tokenFactory.verifyTokenAsync(masterTokenText)
                    .then(masterToken => tokenFactory.createAccessTokenAsync(masterToken))
            } else {
                let loginId = req.params.loginId;
                let loginPassword = req.params.loginPassword;
                let authenticator = req.getServerComponent('Authenticator');
                return authenticator.authAsync(loginId, loginPassword)
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
                'spawned access token from master token'
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