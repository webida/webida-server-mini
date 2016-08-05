'use strict';

const {fsx, restify} = __webida.libs;
const helper = require('../../helper.js')(module);
const Stats = require('../../../models/Stats.js');

function copy(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let { wfsPath, srcPath } = helper.resolvePaths(req);
        let srcStats = null;
        let dstStats = null;

        let doMove = () => {
            if (dstStats) {
                if (!dstStats.isFile() && dstStats.isDirectory() ) {
                    throw new restify.InvalidArgumentError(
                        'invalid destination type ' + dstStats.type);
                }
                if (dstStats.type !== srcStats.type) {
                    throw new restify.InvalidArgumentError(
                        `src type ${srcStats.type} is different to dst type ${dstStats.type}`
                    );
                }
            } 
            return fsx.copyAsync(srcPath, wfsPath, {
                clobber: !req.params.noOverwrite,
                dereference: req.params.followSymbolicLinks,
                preserveTimestamps: req.params.preserveTimestamps
            }); 
        };

        fsx.statAsync(srcPath)
            .then( stats => {
                srcStats = new Stats(stats);
                return fsx.statAsync(wfsPath);
            }, e => {
                if (e.code === 'ENOENT') {
                    throw new restify.NotFoundError(`srcPath ${req.params.srcPath} not found`, e);
                } else {
                    throw new restify.InvalidArgumentError('invalid srcPath', e);
                }
            })
            .then( stats => {
                dstStats = new Stats(stats);
                return doMove();
            }, e => {
                if (e.code === 'ENOENT') {
                    return helper.ensureParentsAsync(req, wfsPath, true).then( ()=> doMove() );
                } else {
                    throw new restify.InvalidArgumentError('invalid destination Path', e);
                }
            })
            .then( () => finish('done') )
            .catch( e => finish(e) );
        // end of promise chain
    } catch(e) {
        return finish(e);
    }
}

module.exports = {
    'put' : copy
};
