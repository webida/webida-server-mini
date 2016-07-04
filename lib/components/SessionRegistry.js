'use strict';

// const SocketSession = require('../SocketSession.js');

const AbstractComponent = require('./AbstractComponent.js');

class SessionRegistry extends AbstractComponent {

    constructor(server) {
        super('session-registry', [], server);
        this.sessions = {};
        // need secondary index with socket id?
    }

    start() {
        return super.start().then( () => {
            var myself = this;
            this._sessionEventEmitter = this._server.socketServer.sessionEventEmitter;
            this._sessionEventEmitter.on('initialized', (session) => {
                // this event will also be emitted when session recovers client connection
                if (!this.sessions[session.id])
                    myself.addSession(session);
            });
            this._sessionEventEmitter.on('terminated', (session) => {
                myself.removeSession(session.id);
            });
            // when change-workspace event should be handled by workspace registry
            // we don't have to handle here
        });
    }

    addSession(session) {
        this.logger.debug({session}, 'add session');
        this.sessions[session.id] = session;
    }
    
    getSession(sessionId) {
        return this.sessions[sessionId];
    }

    removeSession(sessionId) {
        let session = this.sessions[sessionId];
        delete this.sessions[sessionId];
        this.logger.debug({session}, 'removed session');
        return session;
    }
}


module.exports = SessionRegistry;