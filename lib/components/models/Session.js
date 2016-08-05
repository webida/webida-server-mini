'use strict';

const ApiSessionModel = require('webida-restful-api').Session;
const AbstractDomainModel = require('./AbstractDomainModel.js');

class Session extends AbstractDomainModel {

    // session-registry should be constructed with valid socket
    constructor(socket, sessionId, workspaceId, logger) {
        // (id, name, state, clientAddress, connectedAt, disconnectedAt)
        super(new ApiSessionModel(
            sessionId,
            Session._createName(socket, workspaceId),
            Session.STATES.NORMAL,
            Session._getClientAddress(socket),
            new Date(),
            null
        ));
        this.apiModel.workspaceId = workspaceId || null;
        this.apiModel.willBeClosedAt = null;
        this.socket = socket;
        this._logger = logger.child({session:this.id}, true );

        // socket should join to announcement room after creation.
        this.socket.join('session.announcement');
    }

    get id() {
        return this.apiModel.id; 
    }
    
    get name() {
        return this.apiModel.name; 
    }

    get state() {
        return this.apiModel.state;
    }

    get logger() {
        return this._logger; 
    }
    
    // do 'graceful' close - send 'cloese request' to client first
    close(closeAfter) {
        if (closeAfter > 0) {
            this.logger.debug(`${this.name} requests client to close connection`);
            this.socket.emit('session.closing', closeAfter);
            this.apiModel.state = Session.STATES.CLOSING;
            this._updateDisconnectTimer(closeAfter * 1000);
        } else {
            this._disconnect();
        }
    }

    onSocketDisconnect() {
        this.socket = null;
        this.apiModel.state = Session.STATES.TERMINATED;
        this._updateDisconnectTimer(-1); // clear only
        this.apiModel.willBeClosedAt = null;
        // if this session has been processed events faster than session registry
        // then a 'ghost' session can be seen via api. registry should remove the ghosts
        // when returning api result to client app if needed. but, why not?
    }

    _disconnect() {
        if (this.socket) {
            this.logger.debug(`${this.name} disconnects socket directly`);
            this.socket.disconnect();
            this.socket = null;
        }
    }

    _updateDisconnectTimer(after) {
        if (this._disconnectTimer) {
            clearTimeout(this._disconnectTimer);
            this._disconnectTimer = null;
        }

        if (typeof(after) === 'number' && after >= 0)  {
            let currentTime = new Date().getTime();
            this.apiModel.willBeClosedAt = new Date(currentTime + after);
            this._disconnectTimer = setTimeout( () => this._disconnect(), after);
        }
    }

    static get STATES() {
        return ApiSessionModel.StateEnum;
    }

    static _createName(socket, workspaceId) {
        let prefix = workspaceId ? 'workspace-' + workspaceId : 'global';
        return `${prefix}/` + socket.id;
    }

    static _getClientAddress(socket) {
        if (!socket || !socket.request)
            return 'unknown';
        let xff = socket.request.headers['x-forwarded-for'];
        return xff ? xff.split(',')[0] : socket.handshake.address;
    }
}

module.exports = Session;