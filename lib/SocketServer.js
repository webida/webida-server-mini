'use strict';
const { debugFactory } = __webida.libs;
const debug = debugFactory(module);

const EventEmitter = require('events');
const IO = require('socket.io');
const SessionFactory = require('./SessionFactory.js');

class SocketServer {
    constructor(server) {
        this._server = server;
        // session name space. we may need some other name spaces, for 'terminal'
        this._sessionSpace = null;
        this._io = null;
        this._logger = server.logger.child({ from: 'socket-server'}, true);
        this._tokenManager = server.getComponent('TokenFactory');
        this._sessionRegistry = server.getComponent('SessionRegistry');
        this._sessionEventEmitter = new EventEmitter();
        
        this._sessionEventEmitter.on('initialized', (session) => {
            debug(session, 'got new session');
        });
    }

    get logger() { return this._logger; }
    get io() { return this._io; }
    get sessionSpace() { return this._sessionSpace; }
    get sessionEventEmitter() { return this._sessionEventEmitter; }

    _acceptConnection(socket, next) {
        const { handshake, id } = socket;

        // in socket.io middleware, handshake.query seems to be not available.
        let params = handshake.query; // always not null, I read code.

        if (!params.token) {
            this.logger.error('refusing connection - no token ' + id);
            return next(new Error('need token'));
        }

        this._tokenManager.verifyTokenAsync(params.token, params)
            .then( (token) => {
                let sid = params.sessionId || token.sessionId;
                let wsid = params.workspaceId || token.workspaceId;

                this.logger.debug({
                    token:token,
                    sid:sid,
                    wsid:wsid
                }, 'creating new session with verified parameters');

                let session = this._sessionRegistry.getSession(sid);
                if ( !session ) {
                    let session = SessionFactory.createSession(socket, sid, wsid,
                        this.logger, this._sessionEventEmitter);
                    this.logger.debug(session, 'created new session');
                    return next();
                } else {
                    return session.handleNewSocket(socket, next);
                }
            })
            .catch( (err) => {
                this.logger.error(err, 'refusing connection for error');
                next(err);
            });
    }

    start() {
        // When socket server started, the components are not started yet.
        // we should not invoke any call in this

        let io = new IO(this._server.httpServer);
        let sessionSpace = io.of('/session');

        // in fact, class methods are NOT bound to this.
        // we should manually bind or create a bound closure with fat arrow.
        sessionSpace.use(this._acceptConnection.bind(this));

        this._sessionSpace = sessionSpace;
        this._io = io;

        // when aclient want to change workspace, he 
        // invoke api PUT '/api/sessions/{sessionId} 
        // then, api handler calls SessionRegistry.updateSession()
        // then, SR should call SocketSession#changeWorkspace()
        // then, session leaves workspace room and join to another
        // then, Workspaces get events for the session and update their session list 
        // so, socket server don't have to do anything       
        return this;
    }

    stop() {
        this._sessionEventEmitter.removeAllListeners();
        this._io.close();
        return this;
    }
}

module.exports = SocketServer;
