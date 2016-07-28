'use strict';

class Stats {

    constructor (rawStats) {
        // there are 4 kind of raw stats
        //  1) other Stats (copy construction)
        //  2) node.js FS Stat
        //  3) json object (usually from some 'saved-state' file)

        if (rawStats instanceof Stats) {
            Object.assign(this, rawStats);
            return;
        }

        // case 3 & 4
        this.size = rawStats.size;
        this.mtime = rawStats.mtime;
        this.birthtime = rawStats.birthtime;
        this.nlink = rawStats.nlink;
        this.mode = rawStats.mode;
        this.mode = rawStats.mode;

        // is from node.js ?
        if (rawStats.ino) {
            this.type = Stats.detectType(rawStats); // will never be 'DUMMY'
        } else {
            this.type = rawStats.type;
        }
    }

    // there's no such thing like isFile, isDirectory, ...
    static detectType(rawStats) {

        const typeMap = {
            isFile : "FILE",
            isDirectory : "DIRECTORY",
            isBlockingDevice : "BLOCK_DEVICE",
            isCharacterDevice : "CHARACTER_DEVICE",
            isSymbolicLink : "LINK",
            isFIFO : "FIFO",
            isSocket : "SOCKET"
        };

        // if detecting fails, we treat it as file, for everything on a file system is a file.
        // oddly, in windows, fs.stat() to a some none-file object (e.g. fifo) always fails

        let found = "FILE";
        Object.keys(typeMap).some( function(methodName) {
            if (rawStats[methodName]() ) {
                found = typeMap[methodName];
                return true;
            }
        });

        return found;
    }
    
    static get dummyStats() {
        return new Stats({
            size: -1,
            nlink: -1,
            birthtime: new Date(0),
            mtime: new Date(0),
            mode: 0,
            type: 'DUMMY'
        }); 
    }
}



module.exports = Stats;
