'use strict';

const helper = require('../../helper.js')(module);

function removeAliases(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let aliasId = req.params.aliasId;
        let workspaceId = req.params.workspaceId;
        let srcPath = req.params.srcPath;
        let aliasRegistry = req.getServerComponent('alias-registry');
        aliasRegistry.find(aliasId, workspaceId, srcPath)
            .map(alias => alias.id)
            .forEach(aliasId => aliasRegistry.remove(aliasId));
        finish();
    } catch(e) {
        return finish(e);
    }
}

module.exports = {
    'delete' : removeAliases
};