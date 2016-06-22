'use strict';
const { path } = __webida.libs;
const WebidaServer = require('./WebidaServer.js');
const Workspace = require ('./Workspace.js');

const MASTER_KEY_DURATION = 60 * 60 * 24 * 365 * 10; // 10 years

class EmbeddedWebidaServer extends WebidaServer {

    constructor() {
        super();
        this.contentsDir = path.resolve(__dirname, '..', '..', 'contents');
    }

    addDisposableWorkspaceAsync(localPath) {
        // following codes should be changed to match new webida vfs uri
        let wsr = this._componentFactory.getComponent('WorkspaceRegistry');
        let ws = wsr.getWorkspaceByPath(localPath);
        if (!ws) {
            ws = Workspace.create({
                name : wsr.recommendName(localPath),
                description : 'disposable workspace created by launcher'
            }, localPath);
            ws.disposable = true;
            wsr.addWorkspace(ws);
            this.logger.info({ws}, 'added disposable workspace');
        } else {
            this.logger.debug({ws}, 'already registered workspace');
        }
        ws.accessedAt = new Date();
        return ws.ensureHaveDefaultsAsync();
    }

    addMasterTokenAsync(workspaceId) {
        let tokenFactory= this._componentFactory.getComponent('TokenFactory');
        // In dev mode, usually reload pages and re-issue access token from master token
        // so, master token should live longer than normal use cases.

        // To launch main ui, we need a 'super long duration' master key not to render
        // login form in main ui screen.

        // To launch ide, we don't need so long duration for main ui can create
        //  some restricted master key, but we should also support 'direct creation
        //  from cli arguments like webida.exe C:\Users\weibda\some\my\dir
        //  in that case, main ui will not care about new workspaces

        // so, to make things simple, we just create 'super long living master token'
        // for every case, with given restriction

        return tokenFactory.createMasterTokenAsync(MASTER_KEY_DURATION, workspaceId)
            .then( (token) => {
                this.logger.debug( {token}, 'created master token directly');
                return token;
            });

    }
}


module.exports = EmbeddedWebidaServer;