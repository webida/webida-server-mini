'use strict';

const {fsx, path, debugFactory} = __webida.libs;
const ApiDirEntryModel = require('webida-restful-api').DirEntry;
const AbstractDomainModel = require('./AbstractDomainModel.js');
const Stats = require('./Stats.js');

let debug = debugFactory(module);


class DirEntry extends AbstractDomainModel{

    // TODO - change arguments order same to ApiDirEntryModel
    constructor (stats, name, realPath) {
        super(new ApiDirEntryModel(name, stats, []));
        this.realPath = realPath;
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
                    this.apiModel.children.push(child);
                    return child;
                }
            });
        }
 
    readChildrenAsync() {
        if (!this.isDirectory()) {
            return Promise.resolve(); 
        }
        return fsx.readdirAsync(this.realPath)
            .then( names => Promise.map(names, name => this._addChildAsync(name)) )
            .then( () => this)
            .catch( err => this); // ignores any error. (need better handling?)
    }
    
    expand(depth, maxDepth) {
        if (maxDepth > 0 && depth >= maxDepth) {
            return Promise.resolve(this);
        }
        return this.readChildrenAsync() // always resolves to this
            .then( self => {
                let dirs = self.children.filter( (child) => child.isDirectory() );
                return Promise.map(dirs, (dir) => dir.expand(depth + 1, maxDepth));
            })
            .then(() => this);
    }

    isDirectory() {
        return(this.apiModel.stats.type === 'DIRECTORY');
    }

}

module.exports = DirEntry;
        
