'use strict';

const { fsx } = __webida.libs;
const helper = require('../../helper.js')(module);
const Stats = require('.././Stats.js');

function stat(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let { wfsPath } = helper.resolvePaths(req);
        let dummyFor404 = req.params.dummyFor404;
        fsx.lstatAsync(wfsPath)
            .then( stats => finish(new Stats(stats)) ) // we may need read link here
            .catch( err => finish(dummyFor404 ? Stats.dummyStats : err) );
        // end of promise chain 
    } catch(e) {
        return next(e);
    }
}

module.exports = {
    'get' : stat
};
