'use strict';
const {path, fsx} = global.process.libs;

var restify = require('restify');

function readFile(req, res, next) {

    next = req.getHelper('next-wrapper')(req, res, next, 'readFile');
    try {
        let {ws, wfsId} = req.getHelper('resolve-paths')(req);
        let wfsPath = req.params.wfsPath;

        // TODO : create owr own static serving method & cache it to workspace
        //       Creating a closure for every request is ... foolish.

        let serveStatic = restify.serveStatic({
            directory: ws.rootPath,
            file: wfsPath,
            maxAge: 0   // result should not be cached (need another parameter?)
        });
        
        // serveStatic cannot handle if url has some 'encoded' strings
        // since clients usually encode path parameters with URI encoding, 
        // if the '/' characters in path parameter will be eoncded, too. 

        // TODO : DO NOT GUESS req.url (we may not have '/api' base path sometimes) 
        //        Use sanitize preware or use urijs to parse 

        req.url = '/api/wfs/' + wfsId + '/file/' + wfsPath;
        serveStatic(req, res, next); // must not proceed with 'next' here

    } catch (e) {
        req.log.error(e, "read file error");
        next(e);
    }
}

function writeFile(req, res, next) {

    next = req.getHelper('next-wrapper')(req, res, next, 'writeFile');

    let {wfsPath} = req.getHelper('resolve-paths')(req);
    let ensuredParents = req.getHelper('ensured-parents');

    let dirPrepared = Promise.resolve(true);
    let data = req.params.data;
    let gc = (data) => {
        if (data && data.path) {
            fsx.unlink(data.path, () => {});
        }
    };

    try {
        ensuredParents(req, wfsPath)
            .then( () => {
                if (data instanceof Buffer) {
                    return fsx.writeFileAsync(wfsPath, data);
                } else {
                    // TODO : restify server's body parser should use some parameterized dir
                    return fsx.renameAsync(data.path, wfsPath);
                }
            })
            .then( () => {
                res.send(200, {});
                return next();
            })
            .catch( (e) => {
                gc();
                req.log.error(e, "write file error");
                next(e);
            });
        // end of promise chain. no need to send/next right now

    } catch (e) {
        gc();
        next(e);
    }
}


function rename(req, res, next) {

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
    'get' : readFile,
    'put' : writeFile,
    'post' : rename
};
