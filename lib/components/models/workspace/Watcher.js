/**
 * Created by lunaris on 2016-05-18.
 */

'use strict';

const { debugFactory } = __webida.libs;
const { FSWatcher } = require('chokidar');
const Stats = require('../Stats.js');
const debug = debugFactory(module);

class Watcher {

    // filter should return true if path is not ignored.
    constructor(wfsId, watchPath, excludedPaths, publish, unresolve) {
        this._fsWatcher = null;
        this._wfsId = wfsId;
        this._watchPath = watchPath;
        this._ignored = this._createGlobPatterns(excludedPaths);
        this._publish = publish;
        this._unresolve = unresolve;
    }

    start() {
        let startTime = new Date().getTime();
        let fsWatcher = this._fsWatcher = this._createFsWatcher();
        fsWatcher.add(this._watchPath);
        fsWatcher.on('all', (event, localPath, rawStats) => {
            this._handleFsEvents(event, localPath, rawStats);
        });
        fsWatcher.on('error', err => this._handleError(err) );
        fsWatcher.on('ready', () => this._handleReady(startTime));
        this._publish('workspace.watcher', { type:'start', wfsId: this._wfsId });
    }

    stop() {
        if (this._fsWatcher) {
            this._publish('workspace.watcher', {
                type:'stop',
                wfsId: this._wfsId
            });
            // if fsWatcher is 'emitting' a event, it will not be cancelled
            this._fsWatcher.close();
            this._fsWatcher.removeAllListeners();
        }
    }

    _createGlobPatterns(excludedPaths) {
        let globPatterns = [];
        excludedPaths.forEach(pattern => {
            let p = pattern.trim();
            if(p.charAt(0) === '#' || p === '') {
                return;
            }
            if (p.slice(-1) !== '/') {
                globPatterns.push(p);
            }
            let suffix = (p.slice(-1) == '*') ? '*' : '/**';
            globPatterns.push(p + suffix);
        });
        return globPatterns.map(p => p.charAt(0) === '/' ? p : '**/' + p);
    }

    _createFsWatcher() {
        const opts = {
            persistent: true,
            ignoreInitial: true,
            ignorePermissionErrors : true,
            followSymlinks: false,
            atomic: false,
            ignored : this._ignored
        };
        debug(opts, 'created fs watcher on ' + this._watchPath);
        return new FSWatcher(opts);
    }

    _handleError(err) {
        // in fact, we can do nothing with error.
        debug(err, `${this._wfsId} got watcher error`);
        this._publish('workspace.watcher.error', {
            type: 'error',
            wfsId : this._wfsId,
            error : err.message
        });
    }

    _handleReady(startTime) {
        let endTime = new Date().getTime();
        debug({
            estimatedTime: endTime - startTime,
            watchPath: this._watchPath
        }, 'ready to watch');
        this._publish('workspace.watcher', {
            type : 'ready',
            wfsId : this._wfsId
        });
    }

    _handleFsEvents(event, localPath, rawStats) {
        try {
            let eventData = {
                wfsId : this._wfsId,
                type : event,
                wfsPath : this._unresolve(localPath),
                stats : rawStats ? new Stats(rawStats) : undefined
            };

            // debug(eventData, 'publishing watcher event');
            this._publish('workspace.watcher', eventData);
        } catch (e) {
            this._handleError(e);
        }
    }
}

module.exports = Watcher;