/**
 * Created by lunaris on 2016-05-18.
 */

'use strict';

const { assert, path, debugFactory } = __webida.libs;

const { FSWatcher } = require('chokidar');
const Stats = require('./api/models/Stats');
const debug = debugFactory(module);

const FS_WATCH_OPTIONS = {
    persistent: true,
    ignoreInitial: true,
    ignorePermissionErrors : true,
    followSymlinks: false,
    
    // TODO: respect workspace's exclude paths.
    ignored: [ '**/.git/*',
        '**/bower_components/*',
        '**/node_modules/*'],
    atomic: false
};

class Watcher {

    constructor(wfsId, wfsRootPath, watchPath, broadcaster) {
        this.wfsId = wfsId;
        this.wfsRootPath = wfsRootPath;
        this.watchPath = watchPath;
        this.broadcaster = broadcaster;
        this.fsWatcher = new FSWatcher(FS_WATCH_OPTIONS);
    }

    start() {
        let startTime = new Date().getTime();
        let fsWatcher = this.fsWatcher;
        fsWatcher.add(this.watchPath);
        fsWatcher.on('all', (event, localPath, rawStats) => {
            this._handleFsEvents(event, localPath, rawStats);
        });
        fsWatcher.on('error', err => this._handleError(err) );
        fsWatcher.on('ready', () => {
            let endTime = new Date().getTime();
            debug({
                estimatedTime: endTime - startTime,
                watchPath: this.watchPath
            }, 'ready to watch');
            this.broadcaster.emit('wfsWatcher', this.wfsId, 'start');
        });
    }

    stop() {
        if (this.fsWatcher) {
            // we don't have to emit any event here
            // for all client has lefted already. 
            // In other word, at here, no body listens watcher anymore  
            this.broadcaster.emit('wfsWatcher', this.wfsId, 'stop');
            this.fsWatcher.close();
            this.fsWatcher = null;
        }
    }

    _handleError(err) {
        debug({
            message:err.toString()
        }, 'got watcher error');
        // in fact, we can do nothing with error.
    }

    _handleFsEvents(event, localPath, rawStats) {
        try {
            let vPath = this._unresolvePath(localPath);
            let stats = rawStats ? new Stats(rawStats) : undefined;
            // debug({
            //     wfsId : this.wfsId,
            //     event,
            //     vPath,
            //     stats
            // }, 'emitting wfsRaw event');
            this.broadcaster.emit('wfsRaw',this.wfsId, event, vPath, stats);
        } catch (e) {
            this._handleError(e);
        }
    }

    // TODO : use some binding with Workspace.unresolvePath
    //   find a way to share some data / properties with Workspace
    //   Watcher.setUnresolver?
    //   Watcher.setExcludedPaths?
    _unresolvePath(localPath, absolute) {
        assert(localPath.startsWith(this.wfsRootPath),
            `path ${localPath} is not in workspace watch path ${this.watchPath}`);

        let vPath = localPath.slice(this.wfsRootPath.length + 1);
        if (path.sep === '\\') {
            vPath = vPath.split('\\').join('/');
        }
        return absolute ? '/' + vPath : vPath;
    }
}

module.exports = Watcher;