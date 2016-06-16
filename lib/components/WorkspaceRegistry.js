/**
 * Created by lunaris on 2016-05-25.
 */
"use strict";

var {assert, path, _, debugFactory} = global.process.libs; 

var restify = require('restify');
var uuid = require('node-uuid');
var debug = debugFactory(module);
var Workspace = require('../Workspace.js');

var AbstractComponent = require('./AbstractComponent.js');

class WorkspaceRegistry extends AbstractComponent {

    constructor(server) {
        super('workspace-registry', ['workspaces'], server);
        this.workspaces = {};
        this.pathMap = {};
        this._basenameCounter = {}; // workspace name is not unique.
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
    
    destroy() {
        // we should filter out instant workspaces before saving
        // so, super.destroy() is not enough 
        let data = {
            workspaces :  _.pickBy(this.workspaces, ws => !(ws.disposable) )
        };
        return super.flushAsync(data, true).then( result => {
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
        return workspace;
    }

    deleteWorkspace(workspaceId) {
        let target =  this.workspaces[workspaceId];
        if (target) {
            delete this.workspaces[workspaceId];
            delete this.pathMap[target.workspacePath];
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