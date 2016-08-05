/**
 * Created by lunaris on 2016-05-18.
 */

'use strict';

const { fsx } = __webida.libs;

// TODO : create Config component and move this class to components/config
// Config component need to help
//  1) new server apis to read/update config
//  2)
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

    existsAsync() {
        return fsx.existsAsync(this.path);
    }
}

module.exports = JsonFile;