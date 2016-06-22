'use strict';

// currently don't support login via credential
// only master token will work

const RESTRICTED_MASTER_TOKEN_DURATION = 60 * 60 * 24 * 30 * 6;  // 180 days 

function issueToken(req, res, next) {
    next = req.getHelper('next-wrapper')(req, res, next, 'issueToken');
    
    try {
        let tokenFactory = req.getServerComponent('TokenFactory');
        let tokenPromise;

        req.log.debug({
            params : req.params,
            currentToken : req.token
        }, 'issueing token');

        // TODO: make token expiration time configurable
        if (req.params.type === 'MASTER') {
            tokenPromise = tokenFactory.createMasterTokenAsync(
                RESTRICTED_MASTER_TOKEN_DURATION, req.params.workspaceId );
        } else {
            tokenPromise = tokenFactory.createAccessTokenAsync(req.token);
        }
        
        tokenPromise
            .then( newToken => {
                req.log.debug({
                    srcToken : req.token || 'null',
                    newToken
                }, 'new token is issued');
                res.send(200, newToken);
                next();
            })
            .catch( err => next(err) );

    } catch (err) {
        return next(err);
    }
}

module.exports = {
    post : issueToken
};