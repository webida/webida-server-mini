'use strict';

const barePostal = require('postal');
const postal = require('postal.request-reponse')(barePostal);

// using 'deferred' is an anti-pattern. we may have to re-implement request/response
// without postal.request-response wrapper

postal.configuration.promise.createDeferred = () => {
    return {
        resolve : data => {
            if (!this.resolved && !this.rejected) {
                this.resolved = data;
                if (this.doResolve) {
                    this.doResolve(data);
                }
            }
        },
        reject : error => {
            if (!this.resolved && !this.rejected) {
                this.rejected = error;
                if (this.doReject) {
                    this.doReject(error);
                }
            }
        }
    };
};

postal.configuration.promise.getPromise = deferred => new Promise( (resolve, reject) => {
    if (deferred.resolved)
        return resolve(deferred.resolved);
    if (deferred.rejected)
        return reject(deferred.rejected);
    deferred.doResolve = resolve;
    deferred.doReject = reject;
});

const CHANNELS = {
    LIFECYCLE: 'lifecycle',
    WORKSPACE: 'workspace',
    SESSION: 'session',
    SOCKET: 'socket'
};

class EventBus {
    constructor() {
        this.channels = {};
        this.getChannel(CHANNELS.LIFECYCLE);
        this.getChannel(CHANNELS.WORKSPACE);
        this.getChannel(CHANNELS.SESSION);
        this.getChannel(CHANNELS.SOCKET);
    }

    getChannel(channelName) {
        if (!this.channels[channelName]) {
            this.channels[channelName] = postal.channel(channelName);
        }
        return this.channels[channelName];
    }

    removeChannel(channelName) {
        postal.unsubscribeFor(channelName);
        delete this.channels[channelName];
    }

    reset() {
        Object.keys(this.channels).forEach( ch => this.removeChannel(ch) );
    }

    // TODO : add bulk-subscribe/unsubscibe methods to help components manage subscriptions

    *channels() {
        for (let name of this.channels)
            yield this.channels[name];
    }

    static get CHANNELS() {
        return CHANNELS;
    }
}

module.exports = EventBus;

