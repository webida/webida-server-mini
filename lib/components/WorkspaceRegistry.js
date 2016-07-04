/**
 * Created by lunaris on 2016-05-25.
 */
'use strict';

const { path, _ } = __webida.libs;

const Workspace = require('../WorkspaceImpl.js');

const AbstractComponent = require('./AbstractComponent.js');

class WorkspaceRegistry extends AbstractComponent {

    constructor(server) {
        super('workspace-registry', ['workspaces'], server);
        this.workspaces = {};
        this.pathMap = {};
        this._basenameCounter = {}; // workspace name is not unique.
        this._sessionEventEmitter = null;
    }

    // when defaults is an object, this method never throws error
    // we recommend you to set defaults in derived classes
    init() {
        return super.init().then( () => {
            // replace json object to real class instance
            _.forOwn(this.workspaces, (data, id) => {
                let workspace = Workspace.create(data);
                // replace
                this.deleteWorkspace(id);
                this.addWorkspace(workspace);
            });

        });
    }

    start() {
        return super.start().then( () => {
            this._sessionEventEmitter = this._server.socketServer.sessionEventEmitter;
            
            let myself = this;

            this._sessionEventEmitter.on('initialized', (session) => {
                this.logger.debug('workspace registry is adding session', session);
                let wsid = session.workspaceId;
                if (wsid) {
                    myself.workspaces[wsid].attachClient(session.id, session);
                } else {
                    this.logger.debug('workspace registry skipped non-workspace-session', session);
                }
            });

            this._sessionEventEmitter.on('terminated', (session) => {
                let wsid = session.workspaceId;
                if (wsid) {
                    myself.workspaces[wsid].detachClient(session.id);
                }
            });

            this._sessionEventEmitter.on('change-state', (session, oldState) => {
                // if we detach client for 'losing' state, workspace may delete watcher.
                // when the client comes back, restarting the watcher is very heavy job.
                // so, we don't do anything right now
            });

            this._sessionEventEmitter.on('change-workspace', (oldId, session) => {
                // session has always workspace id value here
                // for change-workspace event is fired by WorkspaceSession instance only
                let wsid = session.workspaceId;
                myself.workspaces[wsid].detachClient(oldId);
                myself.workspaces[wsid].attachClient(session.id, session);
            });
        });
    }
    
    destroy() {
        // we should filter out instant workspaces before saving
        // so, super.destroy() is not enough 
        let data = {
            workspaces :  _.pickBy(this.workspaces, ws => !(ws.disposable) )
        };
        return super._flushAsync(data, true).then( () => {
            this.logger.info('server destroyed');
            return this;
        });
    }
    
    addWorkspace(workspace) {
        let basename = path.basename(workspace.workspacePath);
        let nameCount = this._basenameCounter[basename] || '0';
        this.workspaces[workspace.id] = workspace;
        this.pathMap[workspace.workspacePath] = workspace.id;
        this._basenameCounter[basename] = nameCount + 1;

        if (!workspace.eventBroadcaster) {
            let sessionSpace = this._server.socketServer.sessionSpace;
            workspace.eventBroadcaster = sessionSpace.in(workspace.id);
        }
        return workspace;
    }

    deleteWorkspace(workspaceId) {
        let target =  this.workspaces[workspaceId];
        if (target) {
            delete this.workspaces[workspaceId];
            delete this.pathMap[target.workspacePath];
            if (target instanceof WorkspaceImpl) {
                target.dispose();
            }
        }
        let basename = path.basename(target.workspacePath);
        this._basenameCounter[basename] = this._basenameCounter[basename] - 1;
        return target; 
    }

    getWorkspace( workspaceId ) {
        return this.workspaces[workspaceId];
    }
    
    getWorkspaceByPath( workspacePath ) {
        let wsid = this.pathMap[workspacePath];
        return this.workspaces[wsid];
    }

    // should apply returned value to workspace object (or construction parameter) 
    // before adding workspace
    recommendName(localPath) {
        // do we need more generalized padding mechanism?
        let padding = number => number <= 999 ? ("000" + number).slice(-3) : number;
        let basename = path.basename(localPath);
        // if current
        let count = this._basenameCounter[basename];
        if (count > 0) {
            return `${basename}.${padding(count+1)}`;
        } else {
            return basename;
        }
    }

}

module.exports = WorkspaceRegistry;