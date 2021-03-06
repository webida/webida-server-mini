'use strict';

const _ = require('lodash');
const path = require('path');
const util = require('util');
//
// function toCamelCase(str) {
//     if (/^_+$/.test(str) ) {
//         return str;
//     } else {
//         return str.replace(/[_.-](\w|$)/g, (_,x) => x.toUpperCase() );
//     }
// }

function parseProgramArguments() {
    let argv = process.argv;
    const launchedBy = {
        electron: argv[0].endsWith('electron') || argv[0].endsWith['electron.exe'],
        node: argv[0].endsWith('node') || argv[0].endsWith['node.exe'],
        app: argv[0].endsWith('webida') || argv[0].endsWith['webida.exe'],
        script: argv[0].endsWith('webida-server.js')
    };
    let argStartPos = 2;
    if (launchedBy.app || launchedBy.script) {
        argStartPos = 1;
    }

    argv = argv.slice(argStartPos);
    const parsed = require('minimist')(argv);

    __webida.args = parsed._;
    __webida.opts = _.mapKeys(parsed, (value, key) => _.camelCase(key));

    // ensure __webida object properties are safe, as possible as we can
    delete __webida.opts._;
    Object.freeze(__webida.args);
    Object.freeze(__webida.opts);
}

// any env values starting WEBIDA_ will be imported to __webida.opts, in camelCase form
function importProcessEnv() {
    let picked = _.pickBy(process.env, (ev, ek) => ek.startsWith('WEBIDA_') );
    let env = _.mapKeys(picked, (value, key) => {
        return _.camelCase(key.slice(7)); // WEBIDA_SOME_ENV_KEY ==> SOME_ENV_KEY ==> someEnvKey
    });
    let os = require('os');

    // assign some useful values to env
    env.userHome = os.homedir();

    switch (os.platform()) {
        case 'win32':
            env.appHome = path.resolve(process.env.APPDATA, 'webida');
            break;
        case 'darwin':
            env.appHome = path.resolve(env.userHome, 'Library', 'Application Support', 'webida');
            break; 
        default:
            env.appHome = path.resolve(env.userHome, '.webida');
            break; 
    }
    
    // server want his(!!) own env properties
    env.serverRoot = path.resolve(__dirname, '..', '..');
    env.serverHome = path.resolve(env.appHome, 'server');
    env.serverHomeDefaults = path.resolve(env.serverRoot, 'home-defaults');
    env.tmpdir = os.tmpdir();

    // in fact, all complex options exists to be accessed in __webida.env
    // merging overwrites env object, to make command line opts precedes environment vars.
    __webida.env = _.merge(env, __webida.opts) ;

    // devmode overrides some env values.
    if (__webida.env.devmode) {
        __webida.env.serverHome = env.serverHomeDefaults;
        __webida.env.debug = true;
    }
}


// import libs above in a single line = var { _, fsx, path, util} = __webida.libs;
function importLibs() {

    // debugFactory will set some bluebird debugging env variables. so, require it first.
    const debugFactory = require('./debug-factory.js');

    global.Promise = require('bluebird');

    // need some fixing for node fs.exists does not use error-fist callback
    let fsxAsync = Promise.promisifyAll(require('fs-extra'));
    fsxAsync.existsAsync = function existsAsync(path) {
        return new Promise( (resolve, reject) => {
            try {
                fsxAsync.exists(path, (result) => resolve(result) );
            } catch (e) {
                reject(e);
            }
        });
    };

    __webida.libs = {
        // node.js core modules frequently used.
        assert: require('assert'),
        path: path,
        util: util,

        // dependent modules that need some fixing or frequently used
        fsx: fsxAsync,
        restify: require('restify'),
        thing : require('core-util-is'),
        URI: require('urijs'),
        _ : _,

        // internal modules & some utility functions 
        debugFactory : debugFactory,
        isWindows: () => process.platform === 'win32',
        noop : () => undefined
    };

    if (typeof __webida.libs.debugFactory.init === 'function') {
        __webida.libs.debugFactory.init();
    }

    Object.freeze(__webida.libs);
}


function initProcess() {
    global.__webida = {
        env : {},   // WEBIDA_HOME, ... etc
        libs : {},  // path, util, ... and any other common libs.
        args : [],  // normal argv 1, 2, 3, ...
        opts : {},   // debug = true, help = false, enable-xxx : false ...
    };

    parseProgramArguments();
    importProcessEnv();
    importLibs();

    let debug = __webida.libs.debugFactory(module);
    debug({
        pid : process.pid,
        args : __webida.args,
        env : __webida.env
    }, 'initialized webida process');
}

initProcess();
module.exports = __webida;
