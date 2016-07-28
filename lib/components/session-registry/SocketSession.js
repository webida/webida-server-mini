'use strict';

const Session = require('./../http-service/models/Session');

// states changing
//   1) normal : should join to announcement/wfs-{workspaceId} room
//   2) losing : should leave from joined room
//   3) closing : no need to leave from anywhere.
//                in this tate, 'disconnect' terminates session-registry and 'connect'/'reconnect' will
//                be rejected

const LOSE_CLIENT_AFTER = 120;

// internal events(args)
//   initialized(this)
//   terminated(this)
//   change-state(oldState, this)

class SocketSession extends Session {

    // session-registry should be constructed with valid socket
    constructor(socket, sessionId, logger, emitter) {
        super(sessionId);

        // hidden properties - should not be serialized
        Object.defineProperties(this, {
            socket: {
                writable: true,
                value: socket
            },
            logger: {
                writable: false,
                value: logger.child({session: this.id}, true)
            },
            emitter: {
                writable: false,
                value: emitter
            },
            disconnectTimer: {
                enumerable: false,
                writable: true,
                value: null
            },
            closingEvent : {
                enumerable: false,
                writable: true,
                value: null
            }
        });
        this.name = this.socket.id;
        this.clientAddress = SocketSession._getClientAddress(socket);
    }

    static _getClientAddress(socket) {
        if (!socket || !socket.request)
            return 'unknown';
        let xff = socket.request.headers['x-forwarded-for'];
        return xff ? xff.split(',')[0] : socket.handshake.address;
    }

    recover(socket) {
        // it's not clear that given socket is a whole new one or reusing existing one. 
        if (this.socket) {
            this.socket.disconnect();
            if (this.socket.id !== socket.id) {
                this.socket = socket;
                this._initSocket();
            }
        }
        this._updateDisconnectTimer(-1); // just clear timer only
        this.disconnectedAt = undefined;
        this._changeState(Session.STATES.NORMAL);
        // does not rewrite this.connectedAt, to keep the memory of 'first contact' :)
    }

    handleNewSocket(socket, next) {
        // if session-registry exists, (hasn't removed before) and new 'connection' has made
        //    1) client has just reconnected to server
        //    2) client reused access token in another instance
        // case 1-1
        //   - when client has disconnected, session-registry state must have been set to LOSING
        //     if previous state was NORMAL
        //   - now client is back. we should revive the session-registry
        //     it's not sure that socket#id is not changed
        // case 1-2
        //   - when server began protocol 'knight-fall' or just banned a session-registry,
        //     this.state should been changed to 'CLOSING'
        //   - While this.state === 'CLOSING', 'disconnect' event will make session-registry go away
        //   - if socket is not disconnected yet and client tries to connect with same session-registry id,
        //     it means client just want to duplicate session-registry socket. punish him.
        //  case 1-3
        //   - SocketSession state was changed to LOSING and server has announced 'CLOSING' then,
        //     while client has been trying to reconnect...
        //   - Well, it's not his fault that he couldn't receive the announcement.
        //     knight-fall begins.
        //  case 2
        //   - each instance MUST use their own access token and session-registry id. sharing is not allwoed
        //   - so, this connection request is not valid. punish him.
        switch(this.state) {
            case Session.STATES.LOSING:
                this.recover(socket); // case 1-1
                return next();
            case Session.STATES.CLOSING:
                if (this.closingEvent) {
                    this._continueClosing();    // case 1-3
                    return next();
                }
                else {
                    return next(new Error('session-registry should have only 1 connection')); // case 2
                }
            case Session.STATES.NORMAL:
                return next(new Error('session-registry should have only 1 connection')); // case 2
            default:
                return next(new Error('Hit the bug - session-registry state is not valid'));
        }
    }

    beginClosing(closeAfter, event) {

        this.logger.debug({
            session: this.id,
            socket: this.socket.id
        }, 'begin closing a session-registry');

        if(this.state === Session.STATES.LOSING) {
            this.closingEvent = event;
        }

        let currentTime = new Date().getTime();
        let closeAfterTime  = closeAfter * 1000;
        this.willCloseAt = new Date(currentTime + closeAfterTime);
        this._updateDisconnectTimer(closeAfterTime);
        this._changeState(Session.STATES.CLOSING);
    }

    beginLosing() {
        this.logger.debug({
            session: this.id,
            socket: this.socket.id
        }, 'we are losing a client');

        this.disconnectedAt = new Date();
        let currentTime = this.disconnectedAt.getTime();
        let loseAfterTime = LOSE_CLIENT_AFTER * 1000;
        this.willLoseAt = new Date(currentTime + loseAfterTime);

        this._updateDisconnectTimer(loseAfterTime);
        this._changeState(Session.STATES.LOSING);
    }

    _initSocket() {
        let socket = this.socket;
        socket.on('error', (err) => {
            this.logger.error( err, 'something went wrong with socket' );
        });
        socket.on('disconnect', () => {
            let err = null;
            switch(this.state) {
                case Session.STATES.NORMAL:
                    this.beginLosing();
                    break;
                case Session.STATES.LOSING:
                    err = new Error(`disconnetct event fired twice on session ${this.id}`);
                    this.logger.error(err, 'hit the bug');
                    break;
                case Session.STATES.CLOSING:
                    this._terminate();
                    break;
                default:
                    err = new Error('session-registry state is not valid');
                    this.logger.error(err, 'hit the bug');
                    break;
            }
        });
        // this.logger.debug('initialized socket event handlers', socket);
        socket.__attachedToSession = true;
    }

    _terminate() {
        this.logger.debug({session:this}, 'terminiting session-registry');
        this.socket.disconnect();
        this.socket = null;
        this.emitter.emit('terminated', this);
    }

    // set negative value to clear only
    _updateDisconnectTimer(after) {
        if (this.disconnectTimer) {
            clearTimeout(this.disconnectTimer);
        }
        if (after >= 0)  {
            this.disconnectTimer = setTimeout( this._terminate.bind(this), after);
        }
    }

    _continueClosing() {
        this.logger.debug({session:this}, 'continue closing');
        // if we send closing event now,
        // client may (or cannot) receive closing event before connection is completed,
        // so, we have to wait for some time. 0.1 sec will be enough.
        let event = this.closingEvent;
        let socket = this.socket;
        if (event) {
            setTimeout(() => {
                socket.emit('closing', event);
            }, 100);
        }
    }

    _changeState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.emitter.emit('changed-workspace', oldState, this);
    }
    
}


module.exports = SocketSession;