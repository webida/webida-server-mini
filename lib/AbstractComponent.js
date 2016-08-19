/**
 * Created by lunaris on 2016-05-25.
 */
'use strict';

const { _, path} = __webida.libs;
const JsonFile = require ('./JsonFile.js');
const LifecycleEventHandler = require('./LifecycleEventHandler.js');

const LIFECYCLE_EVENT_NAMES = _.values(LifecycleEventHandler.LIFECYCLE_EVENTS);

class AbstractComponent {

    // subclasses should have this[ persistentProperty ]
    //  where persistentProperty is an element of persistentProperties
    constructor(logger, eventBus, dependencyMap) {
        if (this.constructor.name === 'AbstractComponent') {
            throw new Error('AbstractComponent is abstract, cannot be constructed directly');
        }
        this.id = _.kebabCase(this.constructor.name);
        this._logger = logger.child({
            from:this.id
        });
        this._eventBus = eventBus;
        this._lifecycleEventHandlers = {};
        LIFECYCLE_EVENT_NAMES.forEach(eventName => {
            let deps = dependencyMap[eventName] || [];
            let handler = new LifecycleEventHandler(this, eventBus, eventName, deps);
            this._lifecycleEventHandlers[eventName] = handler;
        });
        this.lookupComponent = null;   // will be injected by component registry automatically
    }

    get logger() {
        return this._logger;
    }

    // subclasses should implement this method to load/save some data with lifecycle
    // when a component is created and not initialized, this component can return
    //  a 'default' object.
    _getPersistence() {
        return null;
    }

    // will be called after loading persistence, in init()
    _setPersistence(data) {
        // do nothing, by default
    }

    _getStore() {
        let filePath = path.resolve(__webida.env.serverHome, this.id + '.json');
        return new JsonFile(filePath);
    }

    // when defaults is an object, this method never throws error
    // sub classes shouldset defaults in constructor or before calling super.init()
    init() {
        let persistence = this._getPersistence();
        if (!persistence) {
            return Promise.resolve();
        } else {
            let store = this._getStore();
            return store.existsAsync()
                .then( exists => {
                    if(exists) {
                        this.logger.debug(`${this.id} loading persistence`);
                        return store.loadAsync();
                    } else {
                        // TODO: fix default return to NULL
                        // every '_setPerssistence' should handle falsy value as 'defaults'
                        this.logger.debug(`${this.id} does not have store file yet`);
                        return [];
                    }
                })
                .then( data => {
                    // if _serPersistence throws error, then this chain will be rejected.
                    this._setPersistence(data);
                    return this;
                });
            // end of promise chain
        }
    }

    start() {
        this.logger.debug('starting component ' + this.id);
        return Promise.resolve(this);
    }

    stop() {
        this.logger.debug('stopping component ' + this.id);
        return Promise.resolve(this);
    }

    destroy() {
        return this._flushAsync(true);
    }

    // dispose should be called by registry
    dispose() {
        _.forOwn(this._lifecycleEventHandlers, (handler, eventName) => {
            handler.dispose();
        });
        this._logger = null;
        this._lifecycleEventHandlers = null;
    }

    _flushAsync(noThrow) {
        let persistence = this._getPersistence();
        if (!persistence) {
            return Promise.resolve();
        } else {
            this.logger.debug(`${this.id} persistence = ` + JSON.stringify(persistence));
            return this._getStore().saveAsync(persistence)
                .then( () => {
                    this.logger.info(`${this.id} saved persistence`);
                    return true;
                })
                .catch( e => {
                    this.logger.error(e,`${this.id} could not save persistence`);
                    if (noThrow) {
                        return false;
                    } else {
                        throw e;
                    }
                });
            // end of promise chain
        }
    }
}

module.exports = AbstractComponent;