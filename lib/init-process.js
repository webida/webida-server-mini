"use strict";

let env = process.env;
let debugLib = null;
let debug = null;
let path = require('path');
let util = require('util');

function enableDebug () {
    if (env.WEBIDA_DEVMODE) {
        env.WEBIDA_DEBUG = true;
    }

    if (env.WEBIDA_DEBUG) {
        env.BLUEBIRD_DEBUG = 1;
        env.NODE_ENV = env.NODE_ENV || 'development';
    }

    let debugLibPath = require.resolve('debug');
    if (env.WEBIDA_DEBUG) {
        if(!env.DEBUG) {
            env.DEBUG = "webida:*";
        } else {
            // if some webida: value is contained to $DEBUG
            //  then we don't have to append 'webida:*'
            if (env.DEBUG.indexOf('webida:') < 0) {
                env.DEBUG += ",webida:*";
            }
        }
    } else {
        let hasDebugLibLoaded = require.cache[debugLibPath] ? true : false;
        if (hasDebugLibLoaded && process.env.DEBUG) {
            console.warn("debug module is already loaded. webida code will prints debug messages");
        }
    }
    debugLib = require('debug');
    debug = debugFactory(module);
}

function debugFactory(callerModule) {
    let moduleName = callerModule;
    let noop = () => undefined;
    if (typeof(callerModule) === 'object') {
        let callerPath = callerModule.filename || callerModule.id;
        let topDir = path.resolve(__dirname, '..', '..', '..');
        if ( callerPath.startsWith(topDir) ) {
            moduleName = callerPath.slice(topDir.length + 1);
        }
        else {
            moduleName = '';
        }
    }
    if (!moduleName) {
        return noop;
    }
    let debugFunction = debugLib('webida:' + moduleName);
    return function debugWragger() {
        let msg = util.format.apply(util, arguments);
        return debugFunction(msg);
    };
}

function setWebidaHomeVar() {
    if (process.versions.electron) {
        env.WEBIDA_EMBEDDED = true;
    }
    if (env.WEBIDA_DEVMODE) {
        env.WEBIDA_HOME = env.WEBIDA_HOME || path.resolve(__dirname, '..', 'default-webida-home');
    }
    if (!env.WEBIDA_HOME) {
        let homeDir = process.env.HOME;
        let webidaDirName = '.webida';
        if (!homeDir) {
            // seems no $HOME. maybe windows OS
            homeDir = env.WEBIDA_SERVER_EMBEDDED ? env.APPDATA : env.USERPROFILE;
            if (!homeDir) {
                let msg = 'unable to detect user home directory to locate WEBIDA_HOME';
                debug(msg);
                throw new Error(msg);
            }
            webidaDirName = 'webida';
            process.env.WEBIDA_HOME = path.resolve(homeDir,webidaDirName);
        }
    }
    debug(`initialized process env : pid = ${process.pid} , env = ${util.inspect(process.env)}`);
}

// import libs above in a single line = var { _, fsx, path, util} = process.libs;
function importCommonModules() {
    global.Promise = require('bluebird');

    let promisifyModule = modulePath => Promise.promisifyAll(require(modulePath));
    let fsxAsync = promisifyModule('fs-extra');

    // need some fixing for node fs.exists does not use error-fist callback
    fsxAsync.existsAsync = function existsAsync(path) {
        return new Promise( (resolve, reject) => {
            try {
                fsAsync.exists(path, (result) => { resolve(result)})
            } catch (e) {
                reject(e);
            }
        });
    };

    // upath lacks of 'sep' variable. since upath unixifies paths, use '/' directly

    global.process.libs = {
        assert : require('assert'),
        debugFactory : debugFactory,
        fsx : fsxAsync,
        path : path,
        util : util,
        URI : require('urijs'),
        _ : require('lodash')
    };
    Object.freeze(global.process.libs);
}

enableDebug();
setWebidaHomeVar();
importCommonModules();

module.exports = global.process.libs;
