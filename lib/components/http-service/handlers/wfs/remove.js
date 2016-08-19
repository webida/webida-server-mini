'use strict';

const { fsx, restify } = __webida.libs;
const helper = require('../../helper.js')(module);

function remove(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let { wfsPath } = helper.resolvePaths(req);
        let noRecursive = req.params.noRecursive;

        fsx.lstatAsync(wfsPath)
            .then( stats => stats.isDirectory() )
            .then( isDir => {
                if (isDir && noRecursive) {
                    return fsx.rmdirAsync(wfsPath);
                } else {
                    return fsx.removeAsync(wfsPath);
                }
            })
            .then( () => finish('done') )
            .catch( (e) => {
                let err = e;
                switch (e.code) {
                    case 'ENOENT':
                        err =  new restify.NotFoundError('missing or invalid target', e) ;
                        break;
                    case 'ENOTEMPTY':
                        err = new restify.InvalidArgumentError('cannot delete non-empty dir', e);
                        break;
                    default:
                        break;
                }
                finish(err);
            });
    } catch (e) {
        next(e);
    }
}

module.exports = {
    'delete' : remove
};
