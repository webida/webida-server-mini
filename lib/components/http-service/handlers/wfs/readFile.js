'use strict';
const { restify } = __webida.libs;
const helper = require('../../helper.js')(module);

function readFile(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let workspace = helper.resolveWorkspace(req);

        // no need resolve wfsPath, for serveFile need a relative path
        // no need to sanitize url, for it's done in pre-ware chains, already.
        // no need to decode url, for restify router has done, already.
        let wfsPath = req.params.wfsPath;

        // TODO : create owr own static serving method & cache it to workspace
        //       Creating a closure for every request is ... foolish.
        let serveFile = restify.serveStatic({
            directory: workspace.rootPath,
            file: wfsPath,
            maxAge: 0   // result should not be cached (need another parameter?)
        });

        // should not call finish.
        return serveFile(req, res, next);

    } catch (e) {
        finish(e);
    }
}

module.exports = {
    'get' : readFile
};
