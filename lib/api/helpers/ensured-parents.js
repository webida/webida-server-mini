'use strict';

const {path, fsx, restify} = __webida.libs;

module.exports = function ensuredParents(req, resolvedPath) {
    if (req.ensure) {
        let parentPath = path.resolve(resolvedPath, '..');
        return fsx.ensureDirAsync(parentPath).then(
            () => {
                req.log.debug({parentPath}, "ensured parent dir path ");
                return true;
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


