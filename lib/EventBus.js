'use strict';

const barePostal = require('postal');
const postal = require('postal.request-reponse')(barePostal);

const Deffered = require('./Deferred.js');

// if we don't use Deffered here, than we have to re-implement whole request/response api
// without postal.request-response wrapper plugin.

postal.configuration.promise.createDeferred = () => new Deffered();
postal.configuration.promise.getPromise = deferred => deffered.promise;

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

