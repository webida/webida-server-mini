'use strict';

const { debugFactory, fsx, path, restify } = __webida.libs;
const { spawn } = require('child_process');
const backend = require('git-http-backend');
const debug = debugFactory(module);

function gitHandler(lookupComponent, req, res, next) {

    let authenticator = lookupComponent('authenticator');
    let workspaceRegistry = lookupComponent('workspace-registry');
    let aliasRegistry = lookupComponent('alias-registry');

    if (!authenticator.authHttpBasic(req, res, next)) {
        // need to do nothing, for next() is called in authenticator already
        return;
    }

    let segments = req.path().split('/');

    // usually, req url is
    //  1) /git/{wfs-id}/some/path/info/refs?service=git-upload-pack
    //  2) /git/{alias-id}/info/refs?service=git-upload-pack
    //  3) /git/{alias-id}/HEAD

    // while info/refs request encodes url properly,
    // subsequent calls does not.
    // So, users should use alias to access git dirs that contains any non-ascii chars.

    let shouldSliceTo = -1;
    if (segments[segments.length-1] === 'refs') {
        shouldSliceTo = -2;
    }
    segments = segments.slice(2, shouldSliceTo);
    if (segments.length < 1) {
        return next(new restify.BadRequestError('invalid git url'));
    }

    let workspace = null, alias = null;
    if (segments.length === 1) {
        alias = aliasRegistry.get(segments[0]);
        if (!alias) {
            return next(new restify.BadRequestError('invalid git url'));
        }
        workspace = workspaceRegistry.getWorkspace(alias.workspaceId);
    } else {
        workspace = workspaceRegistry.getWorkspace(segments[0]);
    }

    let dirPath = '';
    if (workspace) {
        if (!alias) {
            dirPath = workspace.rootPath + path.sep + segments.slice(1).join(path.sep);
        } else {
            dirPath = workspace.resolvePath(alias.sourcePath);
        }
    } else {
        return next(new restify.BadRequestError('invalid git url'));
    }

    // dirPath should be an 'existing dir path'
    fsx.statAsync(dirPath)
        .then(stats => stats.isDirectory())
        .then( isDir => {
            if (isDir) {
                req.pipe(backend(req.url, function (err, service) {
                    if (err) {
                        req.log.error(err, 'preparing git backend service process error');
                        return res.end(501, err + '\n');
                    }
                    let info = {
                        cmd: service.cmd,
                        args: service.args,
                        type: service.type,
                        action: service.action,
                        fields : service.fields,
                        dirPath : dirPath
                    };
                    res.setHeader('content-type', service.type);

                    let gitBackendProc = spawn(service.cmd, service.args.concat(dirPath));
                    gitBackendProc.stdout.pipe(service.createStream())
                        .pipe(gitBackendProc.stdin);

                    gitBackendProc.on('error', (err) => {
                        req.log.error(err, 'git backend process error');
                        // is piping already. client can handle rest of the error.
                    });

                    gitBackendProc.on('exit', (err) => {
                        if (err) {
                            req.log.error(err, 'git backend process exited with error', info);
                        } else {
                            req.log.info(info, 'git backend process done');
                        }
                    });

                })).pipe(res);
            } else {
                next(new restify.BadRequestError('invalid git url'));
            }
        })
        .catch( e => {
            if (e.code === 'ENOENT') {
                next(new restify.BadequestError('invalid git url'));
            } else {
                next(new restify.InternalError('server could not process request'), e);
            }
        });
    // end of chain
}

module.exports = function gitHandlerWrapper(lookupComponent, req, res, next) {
    try {
        gitHandler(lookupComponent, req, res, next);
    } catch (e) {
        req.log.error(e, "git handler error");
        debug(e, 'GIT HANDLER ERROR!');
    }
};