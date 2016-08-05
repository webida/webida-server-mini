/**
 * Created by lunaris on 2016-05-25.
 */
'use strict';

const { debugFactory, path, fsx, _ } = __webida.libs;
const debug = debugFactory(module);
const Workspace = require('./models/Workspace.js');
const AbstractComponent = require('./../AbstractComponent.js');

class WorkspaceRegistry extends AbstractComponent {

    constructor(logger, eventBus, config) {
        super(logger, eventBus, {
            stop: ['socket-service', 'http-service']
        });
        this._workspaces = {};
        this._pathIndex = {};
        this._basenameCounter = {};

        // TODO : add 'state' of component
        //  some api wants to know that this component is 'started or not'
        this._canPublishEvents = false;
    }

    _getPersistence() {
        return _.values(this._workspaces)
                .map(workspace => workspace.apiModel)
                .filter(model => !model.ephemeral);
    }

    _setPersistence(modelArray) {
        let channel = this._eventBus.getChannel('workspace');
        modelArray
            .map(model => new Workspace(model, channel, this._logger))
            .forEach(workspace => this.register(workspace));
    }

    // when defaults is an object, this method never throws error
    // we recommend you to set defaults in derived classes
    init() {
        return super.init().then( () => {
            let socketChannel = this._eventBus.getChannel('socket');
            socketChannel.subscribe(this, {
                'socket.connected': this._onSocketConnected,
                'socket.disconnected' : this._onSocketDisconnected
            });
        });
    }

    // http/socket service should be started 'after' registries
    start() {
        return super.start().then( () => {
            this._canPublishEvents = true;
        });
    }

    // registries should stop after http/socket services
    stop() {
        return super.stop().then( ()=> {
            this._canPublishEvents = false;
            // every workspace object should be disposed
            let shouldBeExpunged =
                _.values(this._workspaces)
                    .map(workspace => workspace.dispose())  // dispose returns workspace itself.
                    .filter(workspace => workspace.deleted);
            this._workspaces = {};
            this._pathIndex = {};
            this._basenameCounter = {};
            return Promise.all(shouldBeExpunged.map(workspace => this._expunge(workspace)));
        });
    }

    register(workspace, allowOverwrite) {
        let existing = this._workspaces[workspace.id];
        if (!existing || allowOverwrite) {
            this._workspaces[workspace.id] = workspace;
            this._pathIndex[workspace.workspacePath] = workspace.id;

            // little cheat for name recommendation.
            let basename = path.basename(workspace.workspacePath);
            let nameCount = this._basenameCounter[basename] || '0';
            this._basenameCounter[basename] = nameCount + 1;

            if (this._canPublishEvents) {
                let channel = this._eventBus.getChannel('workspace');
                channel.publish(`workspace.registered`, workspace);
            }
            return workspace;
        } else {
            debug({ existing, workspace }, 'already registered workspace');
        }
    }

    unregister(workspaceId, deleteContents) {
        let workspace =  this._workspaces[workspaceId];
        if (workspace) {
            delete this._workspaces[workspaceId];
            delete this._pathIndex[workspace.workspacePath];
            if (workspace instanceof Workspace) {
                workspace.dispose();
            }
            if (this._canPublishEvents) {
                let channel = this._eventBus.getChannel('workspace');
                channel.publish(`workspace.unregistered`, workspace);
            }
            let basename = path.basename(workspace.workspacePath);
            this._basenameCounter[basename] = this._basenameCounter[basename] - 1;
            if (deleteContents) {
                workspace.deleted = true;
            }
            return workspace;
        } else {
            debug('invalid workspace id ' + workspaceId);
        }
    }

    _onSocketConnected(data) {
        let workspace = this.getWorkspace(data.workspaceId);
        let socket = data.socket;
        if (!workspace) {
            workspace.addClient(socket.id, data.socket);
            socket.join('workspace-' + workspace.id);
        }
    }

    _onSocketDisconnected(data) {
        let workspace = this.getWorkspace(data.workspaceId);
        if (workspace) {
            workspace.removeClient(data.socket.id);
        }
    }

    _expunge(workspace) {
        const workspacePath = workspace.workspacePath;
        return fsx.removeAsync(workspacePath).then(
            () => this.logger.info('removed deleted workspace dir '+ workspacePath),
            err => this.logger.error(err, 'failed to remove workspace dir ' + workspacePath)
        );
    }

    getWorkspace( workspaceId ) {
        return this._workspaces[workspaceId];
    }
    
    getWorkspaceByPath( workspacePath ) {
        let workspaceId = this._pathIndex[workspacePath];
        return this._workspaces[workspaceId];
    }

    getAllWorkspaces(includeEphemeral) {
        if (includeEphemeral) {
            return _.values(this._workspaces);
        } else {
            return _.pickBy(this._workspaces, workspace => !workspace.ephemeral);
        }
    }

    // should apply returned value to workspace object (or construction parameter) 
    // before adding workspace to registry.
    // TODO : we need a better 'auto-naming'. what a about 'random bird names?'
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

    createWorkspace(params, localPath) {
        if (localPath) {
            let segments = localPath.split(path.sep);
            segments.pop(); // discard basename of path
            params.rootPath = segments.join(path.sep);
            params.workspacePath = localPath;
        }
        let channel = this._eventBus.getChannel('workspace');
        return new Workspace(params, channel, this._logger);
    }
}

module.exports = WorkspaceRegistry;