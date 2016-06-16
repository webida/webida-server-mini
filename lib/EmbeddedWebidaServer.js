"use strict";

var WebidaServer = require('./WebidaServer.js');
var Workspace = require ('./Workspace.js');
var path = require('path');

class EmbeddedWebidaServer extends WebidaServer {

    constructor() {
        super();
        this.contentsDir = path.resolve(__dirname, '..', 'contents');
    }

    addDisposableWorkspace(localPath) {
        // following codes should be changed to match new webida vfs uri
        let wsr = this._componentFactory.getComponent('WorkspaceRegistry');
        let ws = wsr.getWorkspaceByPath(localPath);
        if (!ws) {
            ws = Workspace.create({
                name : wsr.recommendName(localPath),
                description : 'disposable workspace created by launcher'
            },localPath);
            ws.disposable = true;
            wsr.addWorkspace(ws);
            this.logger.info({worspace:ws}, "added disposable workspace");
        } else {
            this.logger.debug({worspace:ws}, "proceed with registered workspace");
        }
        ws.accessedAt = new Date();
        return ws.ensureHaveDefaultsAsync();
    }

    addDisposableMasterToken(workspaceId) {
        let tokenFactory= this._componentFactory.getComponent('TokenFactory');
        return tokenFactory.createMasterToken('webida', workspaceId, true);
    }

}


module.exports = EmbeddedWebidaServer;