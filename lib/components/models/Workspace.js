'use strict';

const { assert, path, fsx, debugFactory } = __webida.libs;

const ApiWorkspaceModel = require('webida-restful-api').Workspace;
const uuid = require('node-uuid');
const ignore = require('ignore');

const AbstractDomainModel = require('./AbstractDomainModel.js');
const Watcher = require('./workspace/Watcher.js');
const debug = debugFactory(module);

// old webida-0.3 API client shares fs between workspaces
// so, every fs api contains workspace dir name in path
// looks silly but we need to keep the behaviour

const DEFAULT_EXCLUDED_PATHS = [ '.git', 'node_modules', 'bower_components' ];
const REMOVE_WATCHER_AFTER = 120 * 1000; // 120s, after losing last clients.

class Workspace extends AbstractDomainModel {
    constructor(params, channel, logger) {
        // function(id, name, description, createdAt, workspacePath, excludedPaths, offlineCachePaths) {
        super(new ApiWorkspaceModel(
            params.id || uuid.v4(),
            params.name || 'unnamed',
            params.description || 'no description',
            params.createdAt || new Date(),
            params.workspacePath || params.rootPath,
            params.excludedPaths ||  DEFAULT_EXCLUDED_PATHS,
            params.offlineCachePaths || []
        ));
        this.apiModel.acessedAt = params.accessedAt || new Date();
        this.apiModel.ephemeral = params.ephemeral || false;
        this.apiModel.rootPath = params.rootPath;

        this.deleted = false;
        this._channel = channel;
        this._logger = logger.child({
            workspace: this.id
        });
        this._clients = {};
        this._watcherRemoveTimer = null;
        this._watcher = null;
    }

    get logger() {
        return this._logger;
    }

    get id() {
        return this.apiModel.id;
    }

    get workspacePath() {
        return this.apiModel.workspacePath;
    }

    // in come case, watcher should be able to started early,
    //  for started watcher takes quite long time to be ready
    startWatcher(forced) {
        if(!this._watcher && (forced || this._hasClients())) {
            this._createWatcher();
            this._watcher.start();
        }
    }

    // workspace don't know the exact type of client yet.
    // if we need, we may fix the client type to Session or Socket
    //
    addClient(clientId, client) {
        if (!this._clients[clientId]) {
            this._clients[clientId] = client;
        }
        if (!this._watcher) {
            this._createWatcher();
            this._watcher.start();
        } else {
            debug( { clientId, hasClients : this._hasClients()}, 'skipped creating watcher');
        }
    }

    removeClient(clientId) {
        delete this.clients[clientId];
        if (this._watcher && !this._hasClients() ) {
            this._updateWatcherRemoveTimer(REMOVE_WATCHER_AFTER);
        }
    }

    _hasClients() {
        return (Object.keys(this._clients).length > 0);
    }

    _createWatcher() {
        let workspaceChannel = this._eventBus.getChannel('workspace');
        let filter = ignore().add(this.apiModel.excludedPaths).createFilter();
        this._watcher = new Watcher(this.id, this.workspacePath,
            (topic, data) => workspaceChannel.publish(topic, data),
            (path, stats) => filter,
            (localPath) => this.unresolvePath(localPath)
        );
    }

    _removeWatcher() {
        if (this._watcher) {
            this._watcher.stop();
            this._watcher = null;
        }
    }

    // if after is negative, this method clears _watcherRemoveTimer only.
    _updateWatcherRemoveTimer(after) {
        if (this._watcherRemoveTimer) {
            clearTimeout(this._watcherRemoveTimer);
            this._watcherRemoveTimer = null;
        }
        if (typeof(after) === 'number' && after > 0) {
            this._watcherRemoveTimer = setTimeout(this._removeWatcher.bind(this), after);
            debug('reserved watcher removal after ' + after);
        }
    }

    dispose() {
        if (this._hasClients() ) {
            debug(`workspace ${this.id} is being disposed with attached clients!`);
        }
        if (this._channel) {
            this._channel = null;
        }
        this._clients = {};
        this._updateWatcherRemoveTimer(-1);
        this._removeWatcher();
        // should return this to help regisry stop, using map & filter
        return this;
    }

    ensureHaveDefaultsAsync() {
        let dotWorkspaceDirPath = path.resolve(this.workspacePath, '.workspace');
        return fsx.ensureDirAsync(dotWorkspaceDirPath).then( () => this );
    }

    // wfsPath can be absoulte but will be normalized first
    // returned path is an 'absolute local path' with platform separator, not unixified
    resolvePath(wfsPath) {
        wfsPath = this.normalizePath(wfsPath);
        let resolveAt = this.rootPath;
        // simple hack for legacy clients
        if (wfsPath.startsWith('.userinfo/')) {
            resolveAt = __webida.env.userHome;
        }
        return wfsPath ? path.resolve(resolveAt, wfsPath) : resolveAt;
    }

    // every 'normalized' wfsPath should be relative path to workspace root
    normalizePath(wfsPath) {
        if (wfsPath[0] === '/') {
            wfsPath = wfsPath.slice(1);
        }
        if (wfsPath.length > 0 && wfsPath[wfsPath.length - 1] === '/') {
            wfsPath = wfsPath.slice(0, -1);
        }
        return wfsPath;
    }

    unresolvePath(localPath, absolute) {
        assert(localPath.startsWith(this.rootPath),
            `path ${localPath} is not in workspace root path ${this.rootPath}`);
        let vPath = localPath.slice(this.rootPath.length + 1);
        if (path.sep === '\\') {
            vPath = vPath.split('\\').join('/');
        }
        return absolute ? '/' + vPath : vPath;
    }
}

module.exports = Workspace;