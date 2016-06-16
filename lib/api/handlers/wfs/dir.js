"use strict";

const {path, fsx} = global.process.libs;
const restify = require('restify');
const DirEntry = require('../../models/DirEntry.js');

function dirTree(req, res, next) {
    next = req.getHelper('next-wrapper')(req, res, next, 'dirTree');
    try {
        let {wfsPath} = req.getHelper('resolve-paths')(req);
        let ignoreError = req.params.ignoreError;

        let maxDepth = (req.params.recursive === true) ? -1 : 1;

        req.log.debug({
            url : req.url,
            recursive : req.params.recursive,
            maxDepth : maxDepth
        }, 'listing start');
        DirEntry.createAsync(path.basename(wfsPath), wfsPath)
            .then( entry => {
                return entry.expand(0, maxDepth)
            })
            .then( entry => {
                if (maxDepth > 0 ) {
                    req.log.debug({entry}, "list entry (simple)");
                }
                res.send(200, entry);
                next();
            })
            .catch( (err) => { next(err) })
    } catch(e) {
        return next(e);
    }
}


function createDir(req, res, next) {
    next = req.getHelper('next-wrapper')(req, res, next, 'createDir');

    let {wfsPath} = req.getHelper('resolve-paths')(req);
    let done = Promise.resolve(true);

    try {
        done = req.params.ensure ? fsx.mkdirsAsync(wfsPath) : fsx.mkdirAsync(wfsPath);
        done.then(() => {
            res.send(200, {});
            next();
        }).catch((e) => {
            e = restify.PreconditionFailedError('cannot create dir ' + e.message || e);
            next(e);
        });
    } catch (e) {
        next(e);
    }
}

function move(req, res, next) {

    // next = req.getHelper('next-wrapper')(req, next, module);
    // let {wfsPath, srcPath} = req.getHelper('resolve-paths', 'srcPath')(req);
    // let done = Promise.resolve(true);
    //
    // try {
    //     done = req.params.ensure ? fsx.mkdirsAsync(wfsPath) : fsx.mkdirAsync(wfsPath);
    //     done.then(() => {
    //         res.send(200, {});
    //         next();
    //     }).catch((e) => {
    //         e = restify.PreconditionFailedError('cannot create dir ' + e.message || e);
    //         next(e);
    //     });
    // } catch (e) {
    //     next(e);
    // }
    
    // TODO : implement our own errors 
    next( restify.InternalError('not implemented yet') );
}

module.exports = {
    'get' : dirTree, 
    'put' : createDir,
    'post' : move
};
