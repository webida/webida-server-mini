'use strict';

const {fsx} = __webida.libs;
const restify = require('restify');
const Stats = require('../../models/Stats.js');

function stat(req, res, next) {
    next = req.getHelper('next-wrapper')(req, res, next, 'stat');
    try {
        let {wfsPath} = req.getHelper('resolve-paths')(req);
        let ignoreError = req.params.ignoreError;

        // we may have to add 'resolve links option ' here if needed
        fsx.lstat(wfsPath, (err, stats) => {
            if (!err) {
                res.json(200, new Stats(stats));
                return next();
            } else {
                req.log.debug({err}, "fsx.lstat got error");
                if (ignoreError) {
                    res.json(200, new Stats('not found'));
                    return next();
                } else {
                    return next(err);
                }
            }
        });
        // no need to throw anything
    } catch(e) {
        return next(e);
    }
}

function remove(req, res, next) {

    next = req.getHelper('next-wrapper')(req, res, next, 'remove');

    try {
        let {wfsPath} = req.getHelper('resolve-paths')(req);
        let recursive = req.params.recursive;

        fsx.lstatAsync(wfsPath)
            .then ( stats => stats.isDirectory() )
            .then ( (isDir) => (!isDir || recursive) ? fsx.removeAsync(wfsPath) : fsx.rmdirAsync(wfsPath) )
            .then ( () => {
                res.send(200, {});
                next();
            })
            .catch( (e) => {
                if (e.code === 'ENOENT') {
                    e =  new restify.NotFoundError('missing or invalid target', e) ;
                }
                next(e);
            });
    } catch (e) {
        next(e);
    }
}

module.exports = {
    'get' : stat, 
    'delete' : remove
};
