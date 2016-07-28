'use strict';

const path = require('path');
const util = require('util');

let debugLib = null;
const noop = () => undefined;

function debugFactory(caller) {
    let callerName = caller;
    if (!callerName) {
        return noop;
    }

    // some module names will meet collision
    // but we don't want to make things too complex. 
    // better than too long debug message
    if (typeof callerName === 'object') {
        let callerPath = callerName.filename || callerName.id;
        callerName = path.basename(callerPath);
    }
    let debugFunction = debugLib('webida:' + callerName);

    // we want ('bunyan like' debug method, not a dirty formatter
    // e.g. debug( {v1, v2, v3}, "here v comes" )

    return function debugWrapper() {
        let msg = arguments[0];
        if (msg) {
            let inspectOptions = {
                showProxy: true,
                depth: 4,    // too small? but it's too hard to read something deeper than 4
                maxArrayLength: 20
            };
            if (typeof(msg) === 'object') {
                msg = arguments[1] || '';
                debugFunction(msg);
                let obj = arguments[0];
                Object.keys(obj).forEach((key) => {
                    debugFunction(' with %s = %s', key, util.inspect(obj[key], inspectOptions));
                });
            } else {
                debugFunction(msg);
            }
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
            let msg = 'debug module is already loaded. webida code will prints debug messages';
            process.stderr.write (msg + '\n');
        }
    }
    debugLib = require('debug');
    delete debugFactory.init;
}

enableDebug();
module.exports = debugFactory;