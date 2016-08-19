'use strict';

const { restify } = __webida.libs;
const cookieParser = require('cookieparser');
const helper = require('./helper.js')(module);

function handleDirectReadRequest(req, res, next) {
    let cookie = req.headers.cookie;
    if (!cookie) {
        return next( new restify.UnauthorizedError('need a cookie'));
    }

    let token = cookieParser.parse(cookie).token;
    if (!token) {
        return next( new restify.UnauthorizedError('need a token'));
    }

    let authenticator = req.getServerComponent('authenticator');
    authenticator.authToken(token)
        .then(tokenObj => {
            // we don't need explicit access control here,
            // for we allow 'reading' for any authenticated clients.
            const { workspace, wfsPath } = helper.resolvePaths(req);
            let serveFile = restify.serveStatic({
                directory: workspace.rootPath,
                file: wfsPath,
                maxAge: 0   // result should not be cached (need another parameter?)
            });
            return serveFile(req, res, next);
        })
        .catch(err => {
            return next(err);
        });
    // end of chain
}

module.exports = {
    handleDirectReadRequest
};
