'use strict';

const { fsx } = __webida.libs;
const helper = require('../../helper.js')(module);
const Stats = require('../../models/Stats.js');

function stat(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let { wfsPath } = helper.resolvePaths(req);
        let ignoreError = req.params.ignoreError;
        fsx.lstatAsync(wfsPath)
            .then( stats => finish(new Stats(stats)) ) // we may need read link here
            .catch( err => finish(ignoreError ? Stats.dummyStats : err) ); 
        // end of promise chain 
    } catch(e) {
        return next(e);
    }
}

module.exports = {
    'get' : stat
};
