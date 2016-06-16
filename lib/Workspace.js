"use strict";


var {assert, path, fsx } = global.process.libs;
var uuid = require('node-uuid');

// old webida-0.3 API client shares fs between workspaces
// so, every fs api contains workspace dir name in path
// looks silly but we need to keep the behaviour

class Workspace {
    constructor(params) {
        this.id = params.id || uuid.v4();
        this.rootPath = params.rootPath;                 // hide from client if possible
        this.workspacePath = params.workspacePath || params.rootPath;
        this.name = params.name;

        this.description = params.description;
        this.syncTarget = params.syncTarget;             // URL of sync target in
        this.syncMasterToken = params.syncMasterToken;   // master token to access sync target url 
        this.syncAccessToken = params.syncAccessToken;   // access token. hide from client if possible

        this.createdAt = params.createdAt || new Date(); 
        this.accessedAt = params.accessedAt || new Date();  // will be used 

        assert(this.workspacePath && path.isAbsolute(this.workspacePath),
            "workspace %{this.workspacePath} should have valid, absolute path");
    }

    ensureHaveDefaultsAsync() {
        let dotWorkspaceDirPath = path.resolve(this.workspacePath, '.workspace');
        return fsx.ensureDirAsync(dotWorkspaceDirPath).then( () => this );
        // any other some 'defaults' for workspace? add here
        // (for example some metadata files, ssh/git configs...) 
    }
    
    canSync() {
        return this.syncTarget && this.syncToken; 
    }

    // if vPath is not absolute, path should be relative to rootPath
    resolvePath(wfsPath) {
        wfsPath = this.normalizePath(wfsPath);
        let resolveAt= this.rootPath;
        if(wfsPath.startsWith('.userInfo/')) {
            resolveAt = process.env.WEBIDA_HOME;
        }
        return wfsPath ? path.resolve(resolveAt, wfsPath) : resolveAt;
    }

    normalizePath(wfsPath) {
        if (wfsPath[0] === '/') {
            wfsPath = wfsPath.slice(1);
        }
        if (wfsPath.length > 0 && wfsPath[wfsPath.length-1] === '/') {
            wfsPath = wfsPath.slice(0, -1);
        }
        return wfsPath;
    }

    unresolvePath(localPath) {
        assert(localPath.startsWith(this.rootPath),
            `path ${localPath} is not in workspace root ${this.rootPath}`);
        let vPath = localPath.slice(0, this.rootPath.length -1);
        if (path.sep === '\\') {
            vPath = sep.split('\\').join('/');
        }
        return vPath;
    }

    getIdForClient() {
        return this.id;
    }
}

// for compatiblity to old (1.x) webida client
//  workspace fs root path should be the parent directory of given path 
class LegacyWorkspace extends Workspace{
    constructor(params, localPath) {
        // this simple split-join pattern works for it is impossible to
        // create a directory with path separator in real system
        let segments = localPath.split(path.sep);
        segments.pop(); // discard basename of path
        params.rootPath = segments.join(path.sep);
        params.workspacePath = localPath;
        super(params);
    }

    getIdForClient() {
        return this.id + '/' + path.basename(this.workspacePath);
    }
    
}

// 
// for newer clients, set rootPath only in the params 
// 
Workspace.create = function createWorkspace(params, localPath) {
    if (localPath) {
        return new LegacyWorkspace(params, localPath);
    } else {
        return new Workspace(params);
    }
};


module.exports = Workspace;