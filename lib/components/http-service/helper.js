'use strict';

const {debugFactory, path, fsx, restify} = __webida.libs;

const caller = require('caller');
const thing = require('core-util-is');
const debug = debugFactory(module);

class Helper {

    constructor(handlerModule) {
        switch(typeof handlerModule) {
            case 'string':
                this.handlerModuleName = handlerModule;
                break;
            case 'object':
                this.handlerModuleName = path.basename(handlerModule.filename);
                break;
            default:
                this.handlerModuleName = caller();
                break;
        }
    }

    // overwriting function parameter is not a good idea in the point of performance
    // so, if possible, do not re-assign next to wrapNext() result.
    createFinisher(req, res, next) {
        const caller = this.handlerModuleName;

        // using finishHandler function
        //  1)  res.send() ...
        //      finishHandler()
        //  2) finishHandler(error) // when error is instanceof Error 
        //     if instanceof restify.RestError, status code will be set to error type
        //     if not, status code will be set to 500 and type will be internal error
        //  3) finishHandler(result, status) status code default is 200

        return function finishHandler(result, status) {
            let err;

            if (arguments.length === 0) {
                if (res.statusCode) {
                    return next();
                } else {
                    err = new Error(`${caller} HIT THE BUG - didn't send response data`);
                    req.log.error(err, 'status code was ' + res.statusCode);
                    return next(err);
                }
            }

            // resonse has sent already and there's no way to revert sent response
            if (res.headersSent) {
                let err = new Error(`${caller} HIT THE BUG - is sending result twice`);
                req.log.error(err,'sent header already');
                return next();
            }

            if (result instanceof Error) {
                err = result;
                if (err instanceof restify.RestError) {
                    return next(err);
                } else {
                    debug(err, `${caller} finished with unexpected internal error`);
                    // will be translated to InternalError via restify, later, internally.
                    return next(err);
                }
            }

            // now we're sending result.
            // what about 'string' or null or undefined?
            let statusCode = status || 200;
            if (typeof(result) !== 'object') {
                if (typeof(result) !== 'string') {
                    err = new Error(`${caller} sent invalid result type ${typeof(result)}`);
                    req.log.error(err);
                    result = {};
                    result.message = new String(result).toString();
                } else {
                    let message = result;
                    result = { message };
                }
            }
            res.send(statusCode, result);
            return next();
        };
    }

    ensureParentsAsync(req, targetLocalPath, implicit) {
        if (req.ensureParents || implicit) {
            const parentPath = path.resolve(targetLocalPath, '..');
            return fsx.ensureDirAsync(parentPath).then(
                () => {
                    debug({ parentPath }, "ensured parent dir path ");
                    return true;
                },
                (e) => {
                    e = restify.PreconditionFailedError('cannot create dir ', e);
                    throw e;
                }
            );
        } else {
            // TODO : return Promise.reject if parent dir does not exists
            return Promise.resolve();
        }
    }

    resolveWorkspace(req) {
        let wsid = req.params.wfsId || req.params.workspaceId;
        let wsr = req.getServerComponent('workspace-registry');
        let ws = wsr.getWorkspace(wsid);
        if (!ws) {
            throw new restify.NotFoundError('unregistered workspace id' + wsid);
        }
        return ws;
    }

    // resolve parameters containing virtual path to real local path
    //  for example req.params.wfsPath = abc/def
    //  then { wfsPath } = '/some/dir/to/wfs/root/abc/def
    // for convinience, this api als resovles workspace via wfsId / workspaceId param.

    resolvePaths(req, parameterNames) {

        // TODO check swagger.yaml and set all possible parameters
        const toResolve = parameterNames || ['wfsPath', 'wfsPathList', 'srcPath'];

        const resolving = {};
        toResolve.forEach( param => resolving[param]= true );
        let workspace = this.resolveWorkspace(req);
        let result = { workspace };

        Object.keys(resolving).forEach( param => {
            let paramValue = req.params[param];
            // some params will be 'empty string', (e.g. the value of the parameter is
            // workspace root dir. so, we should not use plain boolean casting rules)
            if (paramValue === null || paramValue === undefined) {
                return;
            }
            // TODO : handle workspace.resolvePath error thrown
            //  or, make it work gracefully & ignore falsy returns
            if (thing.isArray(paramValue)) {
                result[param] = paramValue.map(workspace.resolvePath(req.params[param]));
            } else {
                result[param] = workspace.resolvePath(req.params[param]);
            }

        });
        return result;
    }

}

function createHelper(handlerModule) {
    return new Helper(handlerModule);
}

module.exports = createHelper;