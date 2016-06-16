'use strict';

var restify = require('restify');

// currently don't support login via credential
// only master token will work
function login(req, res, next) {

    next = req.getHelper('next-wrapper')(req, next, module);
    
    try {
        req.log.debug({ loginRequest: req.params }, 'login starts with parameters');

        let masterToken = req.params.masterToken;
        if (!masterToken) {
            throw new restify.InvalidVersionError("cannot login with credential yet");
        }

        let tokenFactory = req.getServerComponent('TokenFactory');
        let newTokenPair = tokenFactory.createAccessToken(masterToken);

        req.log.debug({newTokenPair}, 'got access token pair');
        res.json(200, {
            accessToken : newTokenPair.signed,
            decodedAccessToken : newTokenPair.unsigned 
        });

        return next();

    } catch (err) {
        return next(err);
    }
}

module.exports = {
    post : login
};