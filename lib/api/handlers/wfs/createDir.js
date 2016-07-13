'use strict';

const {restify, fsx} = __webida.libs;
const helper = require('../../helper.js')(module);

function createDir(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let { wfsPath } = req.getHelper('resolve-paths')(req);
        let haveDir = req.params.ensure ? fsx.ensureDirAsync : fsx.mkdirAsync;
        return haveDir.apply(fsx, wfsPath)
            .then(() => finish('done'))
            .catch( e => {
                let err = restify.PreconditionFailedError('cannot create dir ' + e.message || e);
                finish(err);
            });
        // end of promise chain
    } catch (e) {
        next(e);
    }
}

module.exports = {
    'put' : createDir
};
