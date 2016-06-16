/**
 * Created by lunaris on 2016-05-25.
 */
"use strict";

var {path, debugFactory} = global.process.libs;
var JsonFile = require ('../JsonFile.js');

let debug = debugFactory(module);

// TODO : implement some lifecycle enum for server and helper objects
// TODO : implement dependency graph to dispatch lifecycle events in right order

class AbstractComponent {
    constructor(id, persistentProperties, server) {
        this.id = id;
        let persistenceFilePath = path.resolve(process.env.WEBIDA_HOME, this.id + ".json");
        this._persistenceFile = new JsonFile(persistenceFilePath);
        this._persistentProperties = persistentProperties || [];
        this._server = server;
    }

    get logger() {
        return this._server.logger;
    }

    // when defaults is an object, this method never throws error
    // we recommend you to set defaults in derived classes
    init() {
        let loadedPromise = this._persistentProperties.length > 0 ? this._persistenceFile.loadAsync()
            : Promise.resolve({});

        return loadedPromise.then((data)=> {
            debug ('loaded persistence ' + this.constructor.name);
            this._persistentProperties.forEach((prop) => {
                this[prop] = data[prop];
            });
            return this;
        }).catch( (e) => {
            debug ('loading persistence ' + this.constructor.name + ' failed ' + e.message);

            if (this._persistentProperties) {
                throw e;
            }
            return this;
        });
    }

    // server will wait all helpers starts after starting itself
    start() {
        debug ('starting component' + this.constructor.name);
        return Promise.resolve(this);
    }

    stop() {
        debug ('stopping component' + this.constructor.name);
        return Promise.resolve(this);
    }

    flushAsync(data, noThrow) {
        let savedPromise = Promise.resolve();
        let fileContents = data;
        if (!fileContents) {
            fileContents = {};
            this._persistentProperties.forEach( (prop) => {
                fileContents[prop] = this[prop];
            });
        }
        if (Object.keys(fileContents).length > 0) {
            savedPromise = this._persistenceFile.saveAsync(fileContents);
        }
        return savedPromise.then( () => {
            this.logger.info(fileContents, `${this.constructor.name} flushed`);
            return true;
        }, (err) => {
            this.logger.error(err,  `${this.constructor.name} flushing failed`);
            if (noThrow) {
                return false;
            } else {
                throw err;
            }
        });
    }

    destroy() {
        return this.flushAsync(null, true).then( result => this );
    }

};

module.exports = AbstractComponent;