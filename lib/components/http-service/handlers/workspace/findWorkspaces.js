'use strict';

const helper = require('../../helper.js')(module);

function findWorkspaces(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let wsid = req.params.workspaceId;
        let wsr = req.getServerComponent('workspace-registry');
        let result;
        if (wsid !== '*') {
            result = [];
            let ws = wsr.getWorkspace(wsid);
            if (ws)
                result.push(ws.apiModel);
        } else {
            result = wsr.findWorkspaces(req.params.includeEphemeral).map(ws => ws.apiModel);
        }
        finish(result);
    } catch(e) {
        return finish(e);
    }
}

module.exports = {
    'get' : findWorkspaces
};