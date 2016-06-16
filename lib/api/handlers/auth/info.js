'use strict';

var restify = require('restify');


function getMyInfo(req, res, next) {
    next = req.getHelper('next-wrapper')(req, res, next, 'getMyInfo');
    try {
        // TODO : implement a way to read server configuration with helper or component
        res.json(200, {
            uid : 'webida',
            name : 'webida',
            email : 'webida@webida.org'
        });
        return next(); // end of chain
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    get : getMyInfo
};