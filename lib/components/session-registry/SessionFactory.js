'use strict';

const SocketSession = require('./SocketSession');
const WorkspaceSession = require('./WorkspaceSession');

class SessionFactory {
    static createSession(socket, sessionId, workspaceId, logger, emitter) {
        if (workspaceId) {
            logger.debug('creating workspace session-registry');
            return new WorkspaceSession(socket, sessionId, workspaceId, logger, emitter);
        } else {
            return new SocketSession(socket, sessionId, logger, emitter);
        }
    }
}

module.exports = SessionFactory;