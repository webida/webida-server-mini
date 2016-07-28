'use strict';

const { assert, _ , debugFactory } = __webida.libs;
const debug = debugFactory(module);

const Deferred = require('./Deferred.js');

const LIFECYCLE_EVENTS = {
    INIT: 'init',
    START: 'start',
    STOP: 'stop',
    DESTROY: 'destroy'
};

class LifecycleEventHandler {

    constructor(owner, eventName, callback, dependencies ) {
        this._eventName = eventName;
        this._subscriptions = [];
        this._channel = null;

        this._owner = owner;
        this._mask = {};
        this._handling = false;
        this._callback = callback;
        dependencies.forEach(dep => {
            this.mask[dep] = false;
        });

        this.id = owner.id + '/' + eventName + '/handler';

    }

    attachTo(eventBus) {
        let channel = eventBus.getChannel('lifecycle');
        let dependencies = Object.keys(this._mask);
        let sub = channel.subscribe('server.' + this._eventName, this._onServerEvent.bind(this));
        dependencies.map(dep => {
            let baseName = `${dep}.${this._eventName}`;
            let successSub = channel.subscribe(`${baseName}.success`, this._onSuccess.bind(this));
            let errorSub = channel.subscribe(`${baseName}.error`, this._onError.bind(this));
            this._subscriptions.push(successSub);
            this._subscriptions.push(errorSub);
        });
        this._subscriptions.push(sub);
        this._channel = channel;
    }

    detachFrom(eventBus) {
        this._subscriptions.forEach(sub => sub.unsubscribe() );
        this._channel = channel;
    }

    _prepare() {
        let dependencies = Object.keys(this._mask);
        // If we don't use Deffered, we should subscribe every success / error
        // event from a dependent components separately. That's too heavy.
        let promises = dependencies.map(dep => {
            this._mask[dep] = new Deferred();
            return this._mask[dep].promise;
        });
        this._handling = true;
        return promises;
    }

    _isResolved() {
        let dependencies = Object.keys(this._mask);
        if (dependencies > 0 ) {
            for(let componentId of dependencies) {
                if (!this._mask[componentId]) { // false, if not received anything
                    return false; 
                }
            }
        }
        return true;
    }

    // server does not send any event data
    _onServerEvent(data, envelope) {
        // if this handler is dealing previous init/start/stop/destroy event...
        debug(`${this.id} received server event : ${envelope.topic}`);
        assert(!this._handling, 'lifecycle event must not be over-wrapped');
        
        if( Object.keys(this._mask).length === 0 ) {
            debug(`${this.id} has no dependencies`);
            this._invokeCallback(null, {});
        } else {
            debug(`${this.id} waits events from dependencies`);
            let promises = this._prepare();
            Promise.all(promises)
                .then( () => {
                    debug(`${this.id} has resolved all dependencies`);
                    this._invokeCallback(null, this._mask);
                })
                .catch( e => {
                    debug(`${this.id} could not resolve dependencies`);
                    this._invokeCallback(e);
                });
            // now all we have to do, is, just waiting.
        }
    }

    _onSuccess(data, envelope) {
        debug(`${this.id} got component event : ${envelope.topic}`);
        let sender = envelope.topic.split('.')[0];
        this._mask[sender].resolve(data);
        this._mask[sender] = data;
    }

    _onError(error, envelope) {
        debug(`${this.id} got component event : ${envelope.topic}`);
        let sender = envelope.topic.split('.')[0];
        error.sender = sender;
        this._mask[sender].reject(error);
        this._mask[sender] = error;
    }

    _invokeCallback() {
        try {
            this._handling = false;
            this._callback.apply(this._owner, arguments);
        } catch(e) {
            assert(false, 'lifecycle callback should not throw error!')
        }
    }

    static get LIFECYCLE_EVENTS() {
        return LIFECYCLE_EVENTS;
    }
}

module.exports = LifecycleEventHandler;