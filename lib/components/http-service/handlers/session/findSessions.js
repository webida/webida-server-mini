'use strict';

const helper = require('../../helper.js')(module);

function findSessions(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let sid = req.params.sessionId;
        let ssr = req.getServerComponent('session-registry');
        let result;
        if (sid !== '*') {
            result = [];
            let sess = ssr.getSession(sid);
            if (sess)
                result.push(sess.apiModel);
        } else {
            result = ssr.getSessionsByWorkspaceId(req.params.workspaceId).map(sess => sess.apiModel);
        }
        finish(result);
    } catch(e) {
        return finish(e);
    }
}

module.exports = {
    'get' : findSessions
};