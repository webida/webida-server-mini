'use strict';

var path = process.libs.path;

var caller = require('caller');
var restify = require('restify');
var thing = require('core-util-is');

module.exports = function resolvePaths(req, parameterNames, callerModule) {

    let calledBy = '';
    if (req.log.debug()) {
        let callerPath = callerModule ? (callerModule.filename || callerModule.id) : caller();
        calledBy = path.basename(callerPath);
    }

    parameterNames = parameterNames || ['wfsId', 'wfsPath', 'wfsPathList'];

    let wfsId = req.params.wfsId;
    let wsr = req.getServerComponent('WorkspaceRegistry');
    let ws = wsr.getWorkspace(wfsId);
    if (!ws) {
        throw new restify.InvalidArgumentError('invalid filesystem id ' + wfsId);
    }

    let result = {
        ws : ws,
        wfsId : wfsId,
        unresolved : req.params
    };

    parameterNames.forEach( (name) => {
        let param = req.params[name];
        if (param === null || param === undefined) {
            return;
        }
        if (thing.isArray(param)) {
            result[name] = param.map(ws.resolvePath(req.params[name]));
            result.unresolved[name] = param.map(ws.normalizePath(req.params[name]));
        } else {
            result[name] = ws.resolvePath(req.params[name]);
            result.unresolved[name] = ws.normalizePath(req.params[name]);
        }
    });

    if (process.env.WEBIDA_DEBUG) {
        req.log.debug({ result }, calledBy + ' resolved paths from parameters');
    }

    return result;
};

