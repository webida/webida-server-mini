'use strict';

// Stats does not have any logic in it.
// so, we don't have to create a domain model object.
const ApiStatsModel = require('webida-restful-api').Stats;
const AbstractDomainModel = require('./AbstractDomainModel.js');

const DUMMY_STATS = new ApiStatsModel(
    ApiStatsModel.TypeEnum.DUMMY,
    new Date(0), new Date(0),
    0, -1, -1
);

class Stats extends AbstractDomainModel {

    // rawStats are node.js FS Stats object from fs/fs-extra api
    constructor (rawStats) {
        // type, birthtime, mtime, mode, size, nlink
        super(
            Stats.detectType(rawStats),
            rawStats.birthtime,
            rawStats.mtime,
            rawStats.size,
            rawStats.mode,
            rawStats.nlink
        );
    }

    // Some api handlers (copy/move) uses Stats#type property.
    // TODO: remove this method and make them call Stats.detectType directly
    get type()  {
        return this.apiModel.type;
    }

    // there's no such thing like isFile, isDirectory, ...
    static detectType(rawStats) {
        const typeMap = {
            isFile : ApiStatsModel.TypeEnum.FILE,
            isDirectory : ApiStatsModel.TypeEnum.DIRECTORY,
            isBlockingDevice : ApiStatsModel.TypeEnum.BLOCK_DEVICE,
            isCharacterDevice : ApiStatsModel.TypeEnum.CHARACTER_DEVICE,
            isSymbolicLink : ApiStatsModel.TypeEnum.LINK,
            isFIFO : ApiStatsModel.TypeEnum.FIFO,
            isSocket : ApiStatsModel.TypeEnum.SOCKET
        };

        // if detecting fails, we treat it as file, for everything on a file system is a file.
        // oddly, fs.stat() to a some none-file object (e.g. fifo) always fails in Windows OS.
        //  with some permission error. so, usually, those erronous files are not handled by
        //  this class
        let found = ApiStatsModel.TypeEnum.FILE;
        Object.keys(typeMap).some( methodName => {
            if (rawStats[methodName]() ) {
                found = typeMap[methodName];
                return true;
            }
        });
        return found;
    }
    
    static get dummyStats() {
        return DUMMY_STATS;
    }
}

module.exports = Stats;
