'use strict';
const { path } = __webida.libs;
const WebidaServer = require('./WebidaServer.js');

const MASTER_KEY_DURATION = 60 * 60 * 24 * 365 * 10; // 10 years

class EmbeddedWebidaServer extends WebidaServer {

    constructor() {
        super();
        this._contentsDirPath = path.resolve(__dirname, '..', '..', 'contents');
    }

    get serviceUrl() {
        let httpService = this._componentRegistry.getComponent('http-service');
        return httpService.serviceUrl;
    }

    addDisposableWorkspaceAsync(localPath) {
        // following codes should be changed to match new webida vfs uri
        let wsr = this._componentRegistry.getComponent('workspace-registry');
        let ws = wsr.getWorkspaceByPath(localPath);
        if (!ws) {
            ws = wsr.createWorkspace({
                name : wsr.recommendName(localPath),
                description : 'ephemeral workspace created by launcher',
                ephemeral: true
            }, localPath);
            wsr.register(ws);
            this.logger.info({id:ws.id}, 'added ephemeral workspace');
        } else {
            this.logger.debug({id:ws.id}, 'already registered workspace');
        }
        return ws.ensureHaveDefaultsAsync();
    }

    addMasterTokenAsync(workspaceId) {
        let tokenFactory= this._componentRegistry.getComponent('token-factory');
        // Master key duration have to be very long because,
        //  1) dev mode requires reloading pages
        //  2) main ui should not render login form in desktop app 
        //  3) direct launching (without main ui) requires master token, too. 
        //     login form should not be shown in ide ui, if possible.
        return tokenFactory.createMasterTokenAsync(workspaceId, MASTER_KEY_DURATION)
            .then( (token) => {
                this.logger.debug( {token}, 'created master token directly');
                return token;
            });
        
    }
}


module.exports = EmbeddedWebidaServer;