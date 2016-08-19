'use strict';

const helper = require('../../helper.js')(module);

function findAliases(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let aliasId = req.params.aliasId;
        let workspaceId = req.params.workspaceId;
        let srcPath = req.params.srcPath;
        let aliasRegistry = req.getServerComponent('alias-registry');
        let result = aliasRegistry.find(aliasId, workspaceId, srcPath);
        finish(result);
    } catch(e) {
        return finish(e);
    }
}

module.exports = {
    'get' : findAliases
};