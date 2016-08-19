'use strict';

const path = require('path');
const util = require('util');

let debugLib = null;

function noop() { }

const INSPECT_OPTIONS = {
    showProxy: true,
    depth: 2,   // too small? but it's too hard to read something deeper than 3
    maxArrayLength: 20
};

function getCauseOfError(error) {
    if (!error) {
        return null;
    }
    if (error instanceof Error) {
        return typeof(error.cause) === 'function' ? error.cause() : null;
    } else {
        return error.toString();
    }
}

function debugFactory(caller) {
    let callerName = caller;
    if (!callerName) {
        return noop;
    }

    // some module names will meet collision, but we don't want to make things too complex. it's
    // better than too long prefix for each debug message
    if (typeof callerName === 'object') {
        let callerPath = callerName.filename || callerName.id;
        callerName = path.basename(callerPath);
    }
    let debugFunction = debugLib('webida:' + callerName);

    // we want ('bunyan like' debug method, not a dirty formatter. e.g. debug({v1, v2}, 'v pair');
    return function debugWrapper() {
        let msg = arguments[0];
        if (!msg) {
            return;
        }
        if (typeof(msg) === 'object') {
            msg = arguments[1] || '';
            debugFunction(msg);
            let obj = arguments[0];
            if (obj instanceof Error) {
                debugFunction('  with error = %s', obj.stack || obj.message);
                while ((obj = getCauseOfError(obj)) !== null) {
                    debugFunction('  caused by = %s', obj.stack || obj.message || obj);
                }
            } else {
                Object.keys(obj).forEach((key) => {
                    debugFunction('  with %s = %s', key,
                        util.inspect(obj[key], INSPECT_OPTIONS));
                });
            }
        } else {
            debugFunction(msg);
        }
    };
}

// this method is injected to debugFactory
// and will be removed after called, immediately 
function enableDebug () {
    if (__webida.env.debug) {
        process.env.BLUEBIRD_DEBUG = 1;
        process.env.NODE_ENV = process.env.NODE_ENV || 'development';
    }

    let debugLibPath = require.resolve('debug');
    if (__webida.env.debug) {
        if(!process.env.DEBUG) {
            process.env.DEBUG = 'webida:*';
        } else {
            // if some webida: value is contained to $DEBUG
            //  then we don't have to append 'webida:*'
            if (process.env.DEBUG.indexOf('webida:') < 0) {
                process.env.DEBUG += ',webida:*';
            }
        }
    } else {
        let hasDebugLibLoaded = require.cache[debugLibPath] ? true : false;
        if (hasDebugLibLoaded && process.env.DEBUG) {
            let msg = 'debug module is loaded already. webida may print debug messages';
            process.stderr.write (msg + '\n');
        }
    }
    debugLib = require('debug');
    delete debugFactory.init;
}

enableDebug();
module.exports = debugFactory;