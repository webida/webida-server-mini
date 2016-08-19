'use strict';

const barePostal = require('postal');
const postal = require('postal.request-response')(barePostal);

const Deferred = require('./Deferred.js');

// if we don't use Deferred here, than we have to re-implement whole request/response api
// without postal.request-response wrapper plugin.
postal.configuration.promise.createDeferred = () => new Deferred();
postal.configuration.promise.getPromise = deferred => deferred.promise;

const CHANNELS = {
    LIFECYCLE: 'lifecycle',
    WORKSPACE: 'workspace',
    SESSION: 'session',
    SOCKET: 'socket'
};

class EventChannel {
    constructor(channelName, logger) {
        this.name = channelName;
        this._definition = postal.channel(channelName);
        this._subscriptions = {};
        this.logger = logger.child({
            channel:channelName
        });
    }

    publish(topic, data) {
        this._definition.publish(topic, data);
    }

    // subscriber should be  the object that subscribes topics, with 'name' or 'id' property.
    //  if subscriber has no 'id' property, than should set subscriberName arguments.
    // this method allows empty map (not recommended, although)
    // topicToCallbackMap is an object, mapping topic name to callback function
    // callback's 'this' will be set to subscriber. DO NOT BIND callbacks!
    subscribe(subscriber, topicToCallbackMap, name) {
        let subscriberName = EventChannel.getSubscriberName(subscriber, name);
        let subscriptions = this._subscriptions[subscriberName];
        if (!subscriptions) {
            subscriptions = this._subscriptions[subscriberName] = [];
        }

        let map = topicToCallbackMap || {};
        Object.keys(map).forEach(topic => {
            let subscription = this._definition.subscribe(topic, map[topic]);
            subscription.context(subscriber);
            subscription.catch(err => {
                this.logger.error(err, 'subscription callback threw error',
                    { topic, subscriber:subscriberName });
            });
            // not a member of postal SubscritionDefinition
            subscription.subscriber = subscriberName;
            subscriptions.push(subscription);
        });
    }

    unsubscribe(subscriber, name) {
        let subscriberName = EventChannel.getSubscriberName(subscriber, name);
        let subscriptions = this._subscriptions[subscriberName];
        if (subscriptions) {
            subscriptions.forEach(sub => sub.unsubscribe() );
            this.logger.debug(`${subscriberName} unsubscribed all topics`);
        } else {
            this.logger.debug(`${subscriberName} has no subscribed topics`);
        }
    }

    request(topic, parameters, timeout) {
        return this._definition.request({
            topic,
            data:parameters,
            timeout: timeout
        });
    }

    dispose() {
        postal.unsubscribeFor(this.name);
    }

    static getSubscriberName(subscriber, name) {
        return typeof(name) === 'string' ? name : (subscriber.name || subscriber.id);
    }
}

class EventBus {
    constructor(logger) {
        this.channels = {};
        this._logger = logger.child({
            from: 'event-bus'
        });
        Object.keys(CHANNELS).forEach(NAME => {
            let name = CHANNELS[NAME];
            this.channels[name] = new EventChannel(name, this._logger);
        });
    }

    getChannel(channelName) {
        let channel = this.channels[channelName];
        if (!channel) {
            channel = this.channels[channelName] = new EventChannel(channelName, this._logger);
        }
        return channel;
    }

    removeChannel(channelName) {
        let channel = this.channels[channelName];
        if (channel) {
            channel.dispose();
            delete this.channels[channelName];
        }
    }

    reset() {
        Object.keys(this.channels).forEach( ch => this.removeChannel(ch) );
    }

    static get CHANNELS() {
        return CHANNELS;
    }
}

module.exports = EventBus;