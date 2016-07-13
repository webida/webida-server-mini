'use strict';

const { restify, path } = __webida.libs;
const helper = require('../../helper.js')(module);
const DirEntry = require('../../models/DirEntry.js');

function dirTree(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let { wfsPath } = helper.resolvePaths(req);
        let maxDepth = req.params.maxDepth;
        let dirName = path.basename(wfsPath);

        req.log.debug({
            url : req.url,
            maxDepth : maxDepth
        }, 'building dir tree start');

        DirEntry.createAsync(dirName, wfsPath)
            .then( entry => {
                if (!entry) {
                    throw new restify.NotFoundError('cannot get stats of ' + wfsPath);
                } else {
                    return entry.expand(0, maxDepth);
                }
            } )
            .then( entry => {
                if (maxDepth > 0) {
                    req.log.debug({entry}, "list entry (simple)");
                }
                finish(entry);
            })
            .catch( err => finish(err) );
        // end of promise chain        
    } catch(e) {
        return finish(e);
    }
}

module.exports = {
    'get' : dirTree
};
