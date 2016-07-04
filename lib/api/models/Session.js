'use strict';

const STATES = {
    NORMAL: 'NORMAL',
    LOSING: 'LOSING',
    CLOSING:'CLOSING'
};

class Session {

    // session should be constructed with valid socket
    constructor(sessionId) {
        // TODO - need a enum from raw token type
        this.id = sessionId;
        this.name = 'unnamed';
        this.state = STATES.NORMAL;
        this.clientAddress = 'unknown'; 
        this.connectedAt = new Date();
        this.disconnectedAt = null;
        this.willCloseAt = null;
        this.willLoseAt = null;
    }

    static get STATES() {
        return STATES;
    }
}

module.exports = Session;