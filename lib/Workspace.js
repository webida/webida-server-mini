'use strict';

const { assert, path, fsx } = __webida.libs;
const uuid = require('node-uuid');

// old webida-0.3 API client shares fs between workspaces
// so, every fs api contains workspace dir name in path
// looks silly but we need to keep the behaviour

class Workspace {
    constructor(params) {
        this.id = params.id || uuid.v4();
        this.name = params.name || 'unnamed';
        this.description = params.description || 'no description';
        this.createdAt = params.createdAt || new Date();
        this.accessedAt = params.accessedAt || new Date();
        this.rootPath = params.rootPath;             // hide from client if possible
        this.workspacePath = params.workspacePath || params.rootPath;
        this.disposable = !!params.disposable; 
        
        // Of course, workspace : sessions is not 1:N relation
        // But, sessions are basically ephemeral items and doesn't require any persistence. 
        // so, there's no this.session (hidden or not) here. SessionRegistry will save us. 

        assert(this.rootPath && path.isAbsolute(this.rootPath),
            `workspace root path ${this.rootPath} must be a valid, absolute path`);

        assert(this.workspacePath && path.isAbsolute(this.workspacePath),
            `workspace path ${this.workspacePath} must be a valid, absolute path`);
        
        // Basically, Workspace is bound to some server's local file system
        // So, dealing remote workspaces is solely a client's interesting, not server's 
        // Provide proper UI and make them distinguishable from locals, please. :)
    }

    ensureHaveDefaultsAsync() {
        let dotWorkspaceDirPath = path.resolve(this.workspacePath, '.workspace');
        return fsx.ensureDirAsync(dotWorkspaceDirPath).then( () => this );
        // any other some 'defaults' for workspace? add here
        // (for example some metadata files, ssh/git configs...) 
    }

    // wfsPath can be absoulte but will be normalized first
    // returned path is an 'absolute local path' with platform separator (not unixified)
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
            `path ${localPath} is not in workspace root ${this.rootPath}`);

        // $rootPath/local/path --> local/Path
        //  localPath.charAt( rootPath.length ) is always path.sep ( / or \)
        //  to unixify easily, we cut the path 'after' the sep char.
        let vPath = localPath.slice(this.rootPath.length + 1);
        if (path.sep === '\\') {
            vPath = vPath.split('\\').join('/');
        }

        // now we have an 'unresolved' path, not absolute
        //  (of course, is relative to workspace root)
        return absolute ? '/' + vPath : vPath;
    }

}

// for compatiblity to old (1.x) webida client
//  workspace fs root path should be the parent directory of given path 

class LegacyWorkspace extends Workspace {
    constructor(params, localPath) {
        // this simple split-join pattern works for it is impossible to
        // create a directory with path separator in real system
        let segments = localPath.split(path.sep);
        segments.pop(); // discard basename of path
        params.rootPath = segments.join(path.sep);
        params.workspacePath = localPath;
        super(params);
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