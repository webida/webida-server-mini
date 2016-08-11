'use strict';

// currently don't support login via credential
// only master token will work
const helper = require('../../helper.js')(module);

const RESTRICTED_MASTER_TOKEN_DURATION = 60 * 60 * 24 * 30 * 6;  // 180 days 

function issueToken(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    
    try {
        let tokenFactory = req.getServerComponent('token-factory');

        // TODO: make token expiration time configurable
        let getToken = () => {
            if (req.params.type === 'MASTER') {
                return tokenFactory.createMasterTokenAsync(
                    RESTRICTED_MASTER_TOKEN_DURATION, req.params.workspaceId );
            } else {
                return tokenFactory.createAccessTokenAsync(req.token, req.params.workspaceId);
            }
        };

        return getToken()
            .then( newToken => {
                req.log.info({
                    srcToken : req.token || 'null',
                    newToken
                }, 'new token is issued');
                finish(newToken);
            })
            .catch( err => finish(err) );
        // end of promise chain

    } catch (err) {
        return finish(err);
    }
}

module.exports = {
    post : issueToken
};