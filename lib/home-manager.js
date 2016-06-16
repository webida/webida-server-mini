"use strict"

var {fsx, debugFactory, path} = global.process.libs;
var debug = debugFactory(module);

const DEFAULT_WEBIDA_HOME = path.resolve(__dirname, '..', 'default-webida-home');

function createAsync() {
    // TODO : if env.WEBIDA_HOME exists as file, rename it to ${path}.backup.${timestamp}
    return fsx.copyRecursiveAsync(process.env.WEBIDA_HOME, DEFAULT_WEBIDA_HOME);
}

function hasInstalled() {
    // in dev mode, there should be already a WEBIDA_HOME 
    // if not, WEBIDA_HOME may be falsy if init-process found no $HOME or equivalents
    if (!process.env.WEBIDA_HOME) {
        throw new Error('has no process.env.WEBIDA_HOME variable');
    }
    let exists =  fsx.existsSync(process.env.WEBIDA_HOME);
    if (exists) {
        if ( fsx.lstatSync(process.env.WEBIDA_HOME).isDirectory() ) {
            return true; 
        } else {
            let msg = `invalid process.env.WEBIDA_HOME ${process.env.WEBIDA_HOME} which should be a directory`; 
            debug(msg);
            throw new Error(msg);
        }
    } else {
        return false; 
    }
}

module.exports = {
    createAsync,
    hasInstalled
};
