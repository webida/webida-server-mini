'use strict';

var path = require('path');
var restify = require('restify');

// most of helper functions have optional last parameter callerModule
module.exports = function createNextWrapper(req, res, next, caller) {
    return function commonChain(err) {
        caller = caller || 'handler';

        if (!err) {
            // res.send() wrapped by restify sets status code when it's called immediately 
            // so we can safely check if caller has forgot to send result
            if (!res.statusCode) {
                let err = new Error(`${caller} BUG FOUND - ${caller} has not send response data`);
                req.log.error(err);
            } else {
                req.log.debug(`${caller} reaches to end of request pipe line`);
            }
            return next();
        }

        if (err instanceof restify.RestError) {
            return next(err);
        } else {
            req.log.debug(`${caller} chains unexpected internal error`);
            return next(err);
        }
    };
};

