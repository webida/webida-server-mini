'use strict';

const helper = require('../../helper.js')(module);

function findWorkspaces(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let wsid = req.params.workspaceId;
        let wsr = req.getServerComponent('WorkspaceRegistry');
        let result;
        if (wsid !== '*') {
            result = [];
            let ws = wsr.getWorkspace(wsid);
            if (ws)
                result.push(ws);
        } else {
            result = wsr.getAllWorkspaces(req.params.disposable);
        }
        finish(result);
    } catch(e) {
        return finish(e);
    }
}

module.exports = {
    'get' : findWorkspaces
};
