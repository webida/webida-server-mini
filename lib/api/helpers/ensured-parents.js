'use strict';

const {path, fsx} = global.process.libs;
const restify = require('restify');


module.exports = function ensuredParents(req, resolvedPath) {
    if (req.ensure) {
        let parentPath = path.resolve(resolvedPath, '..');
        return fsx.ensureDirAsync(parentPath).then(
            () => {
                req.log.debug({wfsPath}, "ensured parent dir path ");
                return true
            },
            (e) => {
                e = restify.PreconditionFailedError('cannot create dir ', e);
                throw e;
            }
        );
    } else {
        return Promise.resolve();
    }
};


