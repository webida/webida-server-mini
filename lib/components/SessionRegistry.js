'use strict';

// const SocketSession = require('../SocketSession.js');
const { assert, _ } = __webida.libs;
const AbstractComponent = require('../AbstractComponent.js');
const Session = require('./models/Session');

class SessionRegistry extends AbstractComponent {

    constructor(logger, eventBus, config) {
        super(logger, eventBus, {
            stop: ['socket-service', 'http-service']
        });
        this._sessions = null;
        this._socketIndex = null;
    }

    init() {
        return super.init().then( () => {
            this._sessions = {};
            this._socketIndex = {};

            let socketEventChannel = this._eventBus.getChannel('socket');
            socketEventChannel.subscribe({
                'socket.connected': this._onSocketConnected,
                'socket.disconnected': this._onSocketDisconnected
            });
        });
    }

    destroy() {
        let socketEventChannel = this._eventBus.getChannel('socket');
        socketEventChannel.unsubscribe(this);
    }

    getSession(sessionId) {
        return this._sessions[sessionId];
    }

    getSessionBySocketId(socketId) {
        let sessionId = this._socketIndex[socketId];
        return sessionId ? this._sessions[sessionId] : null;
    }

    removeSession(sessionId) {
        let session = this._sessions[sessionId];
        delete this._sessions[sessionId];
        delete this._socketIndex[session.socket.id];
        // if socket is removed via event (including Session#close),
        // Session#onDisconnect sets socket to null

        if (session.socket) {
            this.logger.warn(`force disconnect ${session.name} by server`);
            session.socket.disconnect();
        } else {
            this.logger.debug({session}, 'removed session-registry');
        }
        return session;
    }

    getSessionsByWorkspaceId(workspaceId) {
        _.pickBy(this._sessions, session => {
            return workspaceId === '*' || workspaceId === session.workspaceId;
        });
    }

    _onSocketConnected(data, envelope) {
        const { socket, sessionId, workspaceId } = data;
        assert(!this.getSession(sessionId),
            `socket ${socket.id} is duplicated on session ${sessionId}`);
        this._addNewSession(socket, sessionId, workspaceId);
    }

    _onSocketDisconnected(data, envelope) {
        const socket = data.socket;
        let session = this._socketIndex[socket.id];
        if (session) {
            session.onSocketDisconnect();
        }
        this.removeSession(session.id);
    }

    _addNewSession(socket, sessionId, workspaceId) {
        let session = new Session(socket, sessionId, workspaceId, this.logger);
        this._sessions[sessionId] = session;
        this._socketIndex[socket.id] = session.id;
        return session;
    }
}


module.exports = SessionRegistry;