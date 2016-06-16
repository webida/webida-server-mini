"use strict"

var {fsx, path, debugFactory} = global.process.libs;
var Stats = require('./Stats.js');

let debug = debugFactory(module);

class DirEntry {

    constructor (stats, name, realPath) {
        // any properties that need to be hidden from clients,
        //  should be un-enumerable

        this.children = []; // null means we have not look up children of this entry
        this.name = name; 
        this.stats = stats;

        // hidden property to handle real file system jobs
        Object.defineProperty(this, 'realPath', {
            value : realPath,
            writable:true
        });
    }
    
    static createAsync(name, realPath) {
        return fsx.statAsync(realPath).then( nstats => {
            let stats = new Stats(nstats);
            return new DirEntry(stats, name, realPath)
        })        
    }
    
    _addChildAsync(childName) {
        let childRealPath = this.realPath + path.sep + childName; 
        return DirEntry.createAsync(childName, childRealPath)
            .then( (child) => {
                this.children.push(child);
                return child;
            });                 
        }
 
    readChildrenAsync() {
        if (!this.isDirectory()) {
            return Promise.resolve(); 
        }
        return fsx.readdirAsync(this.realPath)
            .then( (names) => {
                return Promise.map(names, (name) => this._addChildAsync(name))
            })
            .then( () => this )
            .catch( err => this );
    }
    
    expand(depth, maxDepth) {
        if (maxDepth > 0 && depth >= maxDepth) {
            return Promise.resolve(this);
        }
        return this.readChildrenAsync(). // always resolves to this
            then( (self) => {
                let dirs = self.children.filter( (child) => child.isDirectory() );
                return Promise.map(dirs, (dir) => dir.expand(depth + 1, maxDepth))
                    .then(() => self);
            })
    }

    isDirectory() {
        return(this.stats.type === 'DIRECTORY');
    }

}

module.exports = DirEntry;
        
