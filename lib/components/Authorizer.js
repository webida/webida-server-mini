'use strict';

const AbstractComponent = require('./../AbstractComponent.js');
class Authorizer extends AbstractComponent {

    constructor(logger, eventBus, config) {
        super(logger, eventBus, {
            stop: ['http-service', 'socket-service']  // socket service uses authorizer, too!
        });
    }

    isUnrestricted(token) {
        return token.workspaceId ? false : true;
    }

    // if the token of a session is not restricted to any workspaces
    // then the session can modify any other workspace objects in the server.
    // or, can change only the workspeace it belongs to.
    canModifyWorkspace(workspaceId, token) {
        return this.isUnrestricted(token) || token.workspaceId === workspaceId;
    }

    // if the token of a session is not restricted to any workspaces
    // then the session can modify any other session object in the server.
    // or, can change itself.
    // usually, access toeken in 'main' ui is not restricted
    canModifiySession(sessionId, token) {
        return this.isUnrestricted(token) || token.sessionId === sessionId;
    }

    // same to canModifyWorkspace.
    // basically, alias is a part of workspace metadata and requires same access rights
    canModifyAliases(workspaceId, token) {
        return this.isUnrestricted(token) || token.workspaceId === workspaceId;
    }

    canReadWorkspace(workspaceId, token) {
        if (!workspaceId || workspaceId === '*') {
            return this.isUnrestricted(token);
        } else {
            return token.workspaceId === workspaceId; 
        }
    }

    canReadSession(sessionId, token) {
        if (!sessionId || sessionId === '*') {
            return this.isUnrestricted(token);
        } else {
            return token.sessionId === sessionId;
        }
    }

    canReadAliases(workspaceId, token) {
        if (!workspaceId || workspaceId === '*') {
            return this.isUnrestricted(token);
        } else {
            return token.workspaceId === workspaceId;
        }
    }
}

module.exports = Authorizer;