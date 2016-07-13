'use strict';

const uuid = require('node-uuid');

// old webida-0.3 API client shares fs between workspaces
// so, every fs api contains workspace dir name in path
// looks silly but we need to keep the behaviour

const DEFAULT_EXCLUDED_PATHS = [
    '**/.git/**', 
    '**/bower_components/**',
    '**/node_modules/**'
];

class Workspace {
    constructor(params) {
        this.id = params.id || uuid.v4();
        this.name = params.name || 'unnamed';
        this.description = params.description || 'no description';
        this.createdAt = params.createdAt || new Date();
        this.accessedAt = params.accessedAt || new Date();
        this.rootPath = params.rootPath;
        this.workspacePath = params.workspacePath || params.rootPath;
        this.disposable = params.disposable;
        this.excludedPaths = params.excludedPaths || DEFAULT_EXCLUDED_PATHS;
        this.offlineCachePaths = params.offlineCachePaths || [];
    }
}

module.exports = Workspace;