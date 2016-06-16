'use strict';
var {path} = process.libs;


class Stats {

    constructor (rawStats) {

        // there are 4 kind of raw stats
        //  1) other Stats (copy construction)
        //  2) error
        //  3) node.js FS Stat
        //  4) json object (usually from some 'saved-state' file)

        if (rawStats instanceof Stats) {
            Object.assign(this, rawStats);
            return;
        }

        // case 2 - cannot build Stats from null or undefined. it's intended
        if (rawStats instanceof Error || typeof(rawStats) !== 'object') {
            this.error = rawStats.toString();
            this.type = 'DUMMY';
            return;
        }

        // case 3 & 4
        this.size = rawStats.size;
        this.mtime = rawStats.mtime;
        this.birthtime = rawStats.birthtime;
        this.nlink = rawStats.nlink;

        if (rawStats.ino) {
            this.mode = Stats.toReadableModeString(rawStats.mode|| 0);
            this.type = Stats.detectType(rawStats); // will never be 'DUMMY'
        } else {
            this.mode = rawStats.mode;
            this.type = rawStats.type;
        }
    }

    static toReadableModeString (modeNumber) {
        let s = [];
        for (let i = 2; i >= 0; i--) {
            s.push((modeNumber >> i * 3) & 4 ? 'r' : '-');
            s.push((modeNumber >> i * 3) & 2 ? 'w' : '-');
            s.push((modeNumber >> i * 3) & 1 ? 'x' : '-');
        }
        // optional
        if ((modeNumber >> 9) & 4) // setuid
            s[2] = s[2] === 'x' ? 's' : 'S';
        if ((modeNumber >> 9) & 2) // setgid
            s[5] = s[5] === 'x' ? 's' : 'S';
        if ((modeNumber >> 9) & 1) // sticky
            s[8] = s[8] === 'x' ? 't' : 'T';
        return s.join('');
    }

    // there's no such thing like isFile, isDirectory, ...
    static detectType(rawStats) {

        var typeMap = {
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

        var found = "FILE";
        Object.keys(typeMap).some( function(method) {
            if ( rawStats[method]() ) {
                found = typeMap[method];
                return true;
            }
        });

        return found;
    }
}



module.exports = Stats;
