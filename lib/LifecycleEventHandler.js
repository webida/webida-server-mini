'use strict';

const { assert, debugFactory } = __webida.libs;
const debug = debugFactory(module);

const Deferred = require('./Deferred.js');

const LIFECYCLE_EVENTS = {
    INIT: 'init',
    START: 'start',
    STOP: 'stop',
    DESTROY: 'destroy'
};

class LifecycleEventHandler {

    // owner is usually a component, but not always. 
    // owner should 
    //   - have a method named ${eventName} 
    //   - have name or id property
    //   - should attach/detach handler object to the bus, manually

    constructor(owner, eventBus, eventName, dependencies) {
        this.name = (owner.name || owner.id) + '-' + eventName + '-handler';
        this._owner = owner;
        this._eventName = eventName;
        this._mask = {};
        this._handling = false;
        this._channel = null;

        dependencies.forEach(dep => {
            this._mask[dep] = false;
        });
        this._init(eventBus);
    }

    _init(eventBus) {
        if (!this._channel) {
            let createTopicMap = (dependencies) => {
                let map = {};
                map['server.' + this._eventName] = this._onServerEvent;
                dependencies.map(dep => {
                    map[`${dep}.${this._eventName}.success`] = this._onSuccess;
                    map[`${dep}.${this._eventName}.error`] = this._onError;
                });
                return map;
            };
            this._channel = eventBus.getChannel('lifecycle');
            this._channel.subscribe(this, createTopicMap(Object.keys(this._mask)));
            debug(`${this.name} is now attached to event bus`);
        } else {
            debug(`BUG ALERT - ${this.name} is ALREADY attached to event bus!`);
        }
    }

    dispose() {
        if (this._handling) {
            debug(`BUT ALERT - ${this.name} has not finished event handling yet!`);
        }
        if (this._channel) {
            this._channel.unsubscribe(this);
            this._channel = null;
            this._mask = null;
            this._owner = null;
            debug(`${this.name} is now detached from event bus and disposed`);
        } else {
            debug(`bug alert - ${this.name} is ALREADY detached from event bus!`);
        }
    }

    // If we don't use Defferred, we should subscribe every success / error
    // event from a dependent components separately. That's too heavy.
    _prepare() {
        let dependencies = Object.keys(this._mask);
        let promises = dependencies.map(dep => {
            this._mask[dep] = new Deferred();
            return this._mask[dep].promise;
        });
        this._handling = true;
        return promises;
    }

    // server does not send any event data
    _onServerEvent(data, envelope) {
        // if this handler is dealing previous init/start/stop/destroy event...
        debug(`${this.name} received server event : ${envelope.topic}`);
        assert(!this._handling, 'lifecycle event must not be over-wrapped');
        
        if( Object.keys(this._mask).length === 0 ) {
            debug(`${this.name} has no dependencies`);
        } else {
            debug(`${this.name} waits events from dependencies`);
        }
        let promises = this._prepare();
        Promise.all(promises)
            .then( () => {
                debug(`${this.name} has resolved all dependencies`);
                return this._invokeCallback();
            })
            .then( () => {
                this._handling = false;
                let topic = `${this._owner.id}.${this._eventName}.success`;
                this._channel.publish(topic, 'done');
            })
            .catch( e => {
                this._handling = false;
                debug(e, `${this.name} failed`);
                let topic = `${this._owner.id}.${this._eventName}.error`;
                this._channel.publish(topic, e);
            });
        // end of promise chain.
    }

    _onSuccess(data, envelope) {
        debug(`${this.name} got component event : ${envelope.topic}`);
        let sender = envelope.topic.split('.')[0];
        this._mask[sender].resolve(data);
        this._mask[sender] = data;
    }

    _onError(error, envelope) {
        debug(`${this.name} got component event : ${envelope.topic}`);
        let sender = envelope.topic.split('.')[0];
        error.sender = sender;
        this._mask[sender].reject(error);
        this._mask[sender] = error;
    }

    _invokeCallback() {
        debug(`${this.name} invokes owner callback ${this._eventName}()`);
        let callback = this._owner[this._eventName];
        return callback.apply(this._owner, arguments);
    }

    static get LIFECYCLE_EVENTS() {
        return LIFECYCLE_EVENTS;
    }
}

module.exports = LifecycleEventHandler;