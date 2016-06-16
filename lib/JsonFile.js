/**
 * Created by lunaris on 2016-05-18.
 */

"use strict";

var {path, fsx} = global.process.libs;

class JsonFile {
    constructor(filePath, loadNow) {
        this.path = filePath;
        this.data = loadNow ? this.loadSync() : null;
    }
    
    loadAsync() {
        return new Promise( (resolve, reject) => {
            fsx.readJsonAsync(this.path).then( (resolved) => {
                this.data = resolved;
                resolve(this.data);
            }).catch( (e) => {
                this.data = null;
                reject(e);
            });
        });
    }

    loadSync() {
        this.data = fsx.readJsonSync(this.path);
        return this.data;
    }

    saveSync() {
        fsx.writeJsonSync(this.path, this.data);
    }

    saveAsync(data) {
        return new Promise( (resolve, reject) => {
            fsx.writeJsonAsync(this.path, data || this.data ).then( () => {
                if(data) {
                    this.data = data;
                }
                return resolve(this.data);
            }).catch( (e) => {
                return reject(e);
            });
        });
    }

    static get WEBIDA_SERVER_CONFIG_PATH () {
        return path.resolve(process.env.WEBIDA_HOME , 'server-config.json');
    }

}

module.exports = JsonFile;