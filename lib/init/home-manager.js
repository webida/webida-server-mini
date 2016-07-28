'use strict';

const { fsx, path } = __webida.libs;

function createAsync(backup) {
    let ready = () => fsx.ensureDirAsync(
        path.resolve(__webida.env.serverHome, '..')
    );

    if (backup) {
        let backupName = `${__webida.env.serverHome}.backup.${ new Date().getTime() }`;
        ready = fsx.renameAsync(__webida.env.serverHome, backupName);
    }

    return ready().then(
        () => fsx.copyRecursiveAsync(__webida.env.serverHomeDefaults, __webida.env.serverHome)
    );
}

function ensureHaveServerHome(backup) {
    // in dev mode, there should be already a serverHome by init-process.js
    // if not, serverHome may be falsy if init-process found no $HOME or equivalents

    if (!__webida.env.serverHome) {
        throw new Error('has no __webida.env.serverHome variable');
    }
    return fsx.statAsync(__webida.env.serverHome)
        .then(
            stats => stats,
            err => {
                if (err.errno === 'ENOENT') {
                    return null;
                }
                throw err;
            }
        )
        .then( stats => {
            if (!stats) {
                return createAsync(false);
            } else {
                // TODO : check all critical file/dirs exists in the directory
                //  if something is wrong, just throw error
                //   app main / launcher script should handle the error
                return stats.isDirectory() ? true : createAsync(backup);
            }
        });
}

module.exports = {
    ensureHaveServerHome
};
