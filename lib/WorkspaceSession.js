'use strict';

const SocketSession = require('./SocketSession');

class WorkspaceSession extends SocketSession {

    // session should be constructed with valid socket
    constructor(socket, sessionId, workspaceId, logger, emitter) {
        super(socket, sessionId, logger, emitter);
        this.workspaceId = workspaceId;

        // _initSocket should not called in constructor, cause super class has no 'workspaceId' yet.
        this._initSocket();
        // we should not emit 'initialized' in _initSocket
        // for recovery from losing state will call the method again
        this.emitter.emit('ping', this.name);
        this.emitter.emit('initialized', this);
        this.logger.debug('sent ping message', this.name);
        this.logger.debug('sent initialized event', this);
        
    }

    // when change workspaceId, socket should join to the workspace room
    changeWorkspace(workspaceId) {
        if (this.workspaceId === workspaceId)
            return; 
        let oldId = this.workspaceId;
        if (this.workspaceId) {
            // we don't have to modify workspace object directly.
            // for the workspace watches workspace room
            this.socket.leave(this.workspaceId);
        }
        this.workspaceId = workspaceId;
        this.socket.join(this.workspaceId);
        this.emitter.emit('changed-workspace', oldId, this);
    }

    _initSocket() {
        super._initSocket(); 
        this.socket.join(this.workspaceId);
    }

    _terminate() {
        this.socket.leave(this.workspaceId);
        super._terminate(); 
    }

}


module.exports = WorkspaceSession;