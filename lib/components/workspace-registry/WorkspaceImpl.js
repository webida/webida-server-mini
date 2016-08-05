'use strict';

const { assert, path, fsx, debugFactory } = __webida.libs;

const Workspace = require('././Workspace');
const Watcher = require('./../models/workspace/Watcher');
const debug = debugFactory(module);

// since all workspaces same watcher (chokidar) instance
//  we don't have to add individual watcher per workspace 

class WorkspaceImpl extends Workspace {
    constructor(params, eventBroadcaster) {
        super(params);
        // these values are 'hidden' so will not be stringified by JSON.stringify
        Object.defineProperties(this, {
            clients: {          // usually, workspace session-registry
                writable: false, 
                value : {} 
            },
            watcher : {
                writable: true,
                value : null    // should be created when first client is attached
            },
            logger : {
                writable: true,
                value : null    // injected by registry 
            }
        });
        assert(this.rootPath && path.isAbsolute(this.rootPath),
            `workspace root path ${this.rootPath} must be a valid, absolute path`);
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
        assert(localPath.startsWith(this.wfsRootPath),
            `path ${localPath} is not in workspace watch path ${this.watchPath}`);

        let vPath = localPath.slice(this.wfsRootPath.length + 1);
        if (path.sep === '\\') {
            vPath = vPath.split('\\').join('/');
        }
        return absolute ? '/' + vPath : vPath;
    }
    
    attachClient(clientId, client) {
        debug(client, 'adding workspace client');
        if (!this.clients[clientId]) {
            this.clients[clientId] = client;
        }

        if (!this.watcher && this._hasClients() ) {
            this._createWatcher();
        } else {
            debug( {
                clientId,
                hasClients : this._hasClients()
            }, 'skipped creating watcher');
        }
    }

    detachClient(clientId) {
        delete this.clients[clientId];
        // TODO : need some margin to accept client without restarting watcher 
        //   starting watcher is not a cheap job for a large workspace
        //   we'd better to keep watcher for some time, if client can use this workspace.
        if (this.watcher !== null && !this._hasClients() ) {
            this._removeWatcher();
        }
    }
    
    _hasClients() {
        const count = Object.keys(this.clients).length;
        return (count > 0);
    }

    // TODO : improve error handling on watcher 
    //  1) attach/detach clients should be async
    //  2) add/remove workspace in registry should be async, too
    //  3) this workspace needs a logger. Extend the registry logger (see SocketSession)
    //  4) And his watcher needs a logger, too.
    _createWatcher() {
        if (!this.watcher) {
            // wfs id is same to workspace id
            // (should be changed if we separate wfs volume from workspace)
            this.watcher = new Watcher(this.id, this.rootPath,
                this.workspacePath, this.eventBroadcaster);
            this.watcher.start();
        }
    }

    _removeWatcher() {
        if (this.watcher) {
            debug('removing watcher');
            this.watcher.stop();
            this.watcher = null;
        }
    }

    // for compatiblity to old (1.x) webida client
    //  workspace fs root path should be the parent directory of given path
    //  silly, but need to keep compatibility with legacy client code
    static create(params, localPath, eventBroadcaster) {
        if (localPath) {
            let segments = localPath.split(path.sep);
            segments.pop(); // discard basename of path
            params.rootPath = segments.join(path.sep);
            params.workspacePath = localPath;
            return new WorkspaceImpl(params, eventBroadcaster);
        } else {
            return new WorkspaceImpl(params, eventBroadcaster);
        }
    }

}

module.exports = WorkspaceImpl;