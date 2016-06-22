/**
 * Created by lunaris on 2016-05-25.
 */
'use strict';

const {path} = __webida.libs;
const JsonFile = require ('../JsonFile.js');

// TODO : implement some lifecycle enum for server and helper objects
// TODO : implement dependency graph to dispatch lifecycle events in right order

class AbstractComponent {

    // subclasses should have this[ persistentProperty ]
    //  where persistentProperty is an element of persistentProperties
    constructor(id, persistentProperties, server) {
        this.id = id;
        let persistenceFilePath = path.resolve(__webida.env.serverHome, this.id + '.json');
        this._store = new JsonFile(persistenceFilePath);
        this._persistentProperties = persistentProperties || [];
        this._server = server;
    }

    get logger() {
        return this._server.logger;
    }

    get config() {
        return this._server.config;
    }
    
    // when defaults is an object, this method never throws error
    // sub classes shouldset defaults in constructor or before calling super.init()
    init() {
        let loadedPromise = this._persistentProperties.length > 0 ? this._store.loadAsync()
            : Promise.resolve({});

        return loadedPromise.then( (data)=> {
            this.logger.debug(`${this.constructor.name} loaded persistence`);
            this._persistentProperties.forEach( prop => {
                // if persistent data is falsy, don't overwrite to this.
                // subclasses should hanndle what happens later.
                if (data[prop]) this[prop] = data[prop];
            });
            return this;
        }).catch( (error) => {
            this.logger.debug({error},
                `${this.constructor.name} could not load persistence`);
        });
    }

    // server will wait all helpers starts after starting itself
    start() {
        this.logger.debug('starting component' + this.constructor.name);
        return Promise.resolve(this);
    }

    stop() {
        this.logger.debug('stopping component' + this.constructor.name);
        return Promise.resolve(this);
    }

    destroy() {
        return this._flushAsync(null, true).then( () => this );
    }

    _flushAsync(data, noThrow) {
        let savedPromise = Promise.resolve();
        let fileContents = data;
        if (!fileContents) {
            fileContents = {};
            this._persistentProperties.forEach( (prop) => {
                fileContents[prop] = this[prop];
            });
        }
        if (Object.keys(fileContents).length > 0) {
            savedPromise = this._store.saveAsync(fileContents);
        }
        return savedPromise.then( () => {
            this.logger.info(`${this.constructor.name} saved persistence`);
            return true;
        }, (error) => {
            this.logger.debug({error},
                `${this.constructor.name} could not save persistence`);
            if (noThrow) {
                return false;
            } else {
                throw error;
            }
        });
    }
}

module.exports = AbstractComponent;