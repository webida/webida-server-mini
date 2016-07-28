'use strict';

const { fsx } = __webida.libs;
const helper = require('../../helper.js')(module);

function writeFile(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    let data = req.params.data || req.body.data || req.files.data;
    let gc = () => {
        if (data && data.path) {
            fsx.unlink(data.path, () => {});
        }
    };

    try {
        let { wfsPath } = helper.resolvePaths(req);
        helper.ensureParentsAsync(req, wfsPath)
            .then( () => {
                if (data instanceof Buffer) {
                    return fsx.writeFileAsync(wfsPath, data);
                } else {
                    return fsx.renameAsync(data.path, wfsPath);
                }
            })
            .then( () => finish('OK') )
            .catch( (e) => {
                gc();
                finish(e);
            });
        // end of promise chain
    } catch (e) {
        gc();
        finish(e);
    }
}

module.exports = {
    'put' : writeFile
};
