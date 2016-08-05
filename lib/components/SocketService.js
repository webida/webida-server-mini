'use strict';
// const { debugFactory } = __webida.libs;
// const debug = debugFactory(module);

const IO = require('socket.io');
const AbstractComponent = require('./../AbstractComponent.js');

// todo : remove session-registry space
//  all connections are living in default name space

const ROOMS = {
    MANAGEMENT: '@management',
    ANNOUNCEMENT: '@announcement',
    WORKSPACE_PREFIX: '@workspace-'
};

class SocketService extends AbstractComponent {

    constructor(logger, eventBus, config) {
        super(logger, eventBus, {
           start:['session-registry', 'authenticator', 'authorizer', 'http-service']
        });
        this._io = null;
    }

    _acceptConnection(socket, next) {
        const handshake = socket.handshake;
        const socketId = socket.id;

        // in socket.io middleware, handshake.query seems to be not available.
        let params = handshake.query; // always not null, I read code.
        if (!params.token) {
            this.logger.error('refusing connection - no token from ' + socketId);
            return next(new Error('need token'));
        }

        let authenticator = this.lookupComponent('authenticator');
        authenticator.authToken(params.token)
            .then( (token) => {
                // just publishing socket.connected event with connection parameters is not
                // enough, for session service cannot detect this socket is a reconnection
                // or some invalid access. we need to ask it to session registry
                let sid = params.sessionId;
                let wsid = params.workspaceId;

                let authorizer = this.lookupComponent('authorizer');
                if (!authorizer.canModifiySession(sid, token) ||
                    !authorizer.canModifyWorkspace(wsid, token) ) {
                    throw new Error('insufficient access rights');
                }

                let sessionRegistry = this.lookupComponent('session-registry');
                // TODO : replace direct method call with request, if possible.
                if (sessionRegistry.getSessionBySocketId(socket.id)) {
                    throw new Error('duplicated connection on a session');
                }
            })
            .then( () => {
                this.logger.debug({socket : socket.id, params:params }, 'accepted new socket');
                next();
            })
            .catch( (err) => {
                this.logger.error(err, 'refusing connection for error');
                next(err);
                // no need to rethrow. just calling next() completes middleware chain.
            });

        // end of promise chain. next() will be called later, in the chain.
    }

    init() {
        return super.init().then( ()=> {
            let channel = this._eventBus.getChannel('workspace');
            channel.subscribe(this, { 'workspace.#' : this._onWorkspaceEvent });
            channel = this._eventBus.getChannel('session');
            channel.subscribe(this, { 'session.#' : this._onSessionEvent });
        });
    }

    start() {
        // When socket server started, the components are not started yet.
        // we should not invoke any call in this
        return super.start().then( ()=> {
            const httpServer = this.lookupComponent('http-service').httpServer;
            const channel = this._eventBus.getChannel('socket');
            const io = new IO(httpServer);

            io.use((socket, next) => this._acceptConnection(socket, next));

            io.on('connection', socket => {
                const data = {
                    socket : socket,
                    sessionId : socket.handshake.query.sessionId,
                    workspaceId : socket.handshake.query.workspaceId
                };
                socket.on('disconnect', () => channel.publish('socket.disconnected', data));
                // TODO : handle more event handler from socket..
                //  1) custom join to / leave from some room
                //  2) some events from handle terminal instances

                channel.publish('socket.connected', data);
            });

            this._io = io;
            return Promise.resolve(this);
        });
    }

    stop() {
        return super.stop().then( () => {
            this._io.close();
            return Promise.resolve(this);
        });
    }

    _onSessionEvent(session, envelope) {
        // session.registered / session.unregistered
        // events will go to room 'management'
        this._broadcast(ROOMS.MANAGEMENT, envelope.topic, {
            sessionId: session.id
        });
    }

    // TODO: separate register/unregister events from watcher events
    _onWorkspaceEvent(data, envelope) {
        let subject = envelope.topic.split('.')[1];
        // workspace.registered / unregistered events
        if (subject !== 'watcher') {
            this._broadcast(ROOMS.MANAGEMENT, envelope.topic, {
                workspaceId: data.id
            });
        } else {
            let roomName = ROOMS.WORKSPACE_PREFIX + data.wfsId;
            this._boradcast(roomName, envelope.topic, data);
        }
    }

    _broadcast(roomName, eventName, eventData) {
        if(this._io) {
            this._io.to(roomName).emit(eventData);
        }
    }
}

module.exports = SocketService;