'use strict';

const helper = require('../../helper.js')(module);

function getInfo(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        return finish(null, {
            uid : 'webida',
            name : 'webida',
            email : 'webida@webida.org'
        });
    } catch (err) {
        return finish(err);
    }
}

module.exports = {
    get : getInfo
};