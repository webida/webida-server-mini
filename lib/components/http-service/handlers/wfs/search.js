'use strict';

// const { fsx } = __webida.libs;
// const through2 = require('through2');

const helper = require('../../helper.js')(module);

function search(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        throw new Error('not implemented yet');
    } catch(e) {
        return finish(e);
    }
}

module.exports = {
    'get' : search
};
