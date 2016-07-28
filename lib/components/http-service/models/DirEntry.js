'use strict'

const {fsx, path, debugFactory} = __webida.libs;
const Stats = require('./Stats.js');

let debug = debugFactory(module);

class DirEntry {

    constructor (stats, name, realPath) {
        // any properties that need to be hidden from clients,
        //  should be un-enumerable

        this.children = [];
        this.name = name; 
        this.stats = stats;

        // hidden property to handle real file system jobs
        Object.defineProperty(this, 'realPath', {
            value : realPath,
            writable:true
        });
    }
    
    static createAsync(name, realPath) {
        return fsx.lstatAsync(realPath)
            .then(
                stats => new DirEntry(new Stats(stats), name, realPath),
                err => {
                    debug(err, 'create async error');
                    return null;
                }
            );
        }
    
    _addChildAsync(childName) {
        let childRealPath = this.realPath + path.sep + childName; 
        return DirEntry.createAsync(childName, childRealPath)
            .then( (child) => {
                if (child) {
                    this.children.push(child);
                    return child;
                }
            });
        }
 
    readChildrenAsync() {
        if (!this.isDirectory()) {
            return Promise.resolve(); 
        }
        return fsx.readdirAsync(this.realPath)
            .then( (names) => {
                return Promise.map(names, (name) => this._addChildAsync(name));
            })
            .then( () => this )
            .catch( err => this ); // ignores any error. (need better handling?)
    }
    
    expand(depth, maxDepth) {
        if (maxDepth > 0 && depth >= maxDepth) {
            return Promise.resolve(this);
        }
        return this.readChildrenAsync(). // always resolves to this
            then( (self) => {
                let dirs = self.children.filter( (child) => child.isDirectory() );
                return Promise.map(dirs, (dir) => dir.expand(depth + 1, maxDepth));
            }).
            then( () => this );
    }

    isDirectory() {
        return(this.stats.type === 'DIRECTORY');
    }

}

module.exports = DirEntry;
        
