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
    constructor(wfsId, watchPath, publish, filter, unresolve) {
        this._wfsId = wfsId;
        this._watchPath = watchPath;
        this._publish = publish;
        this._filter = filter;
        this._unresolve = unresolve;
        this._fsWatcher = null;
        this._predicateCache = null;
    }

    start() {
        let startTime = new Date().getTime();
        let fsWatcher = this._fsWatcher = this._createFsWatcher();
        this._predicateCache = {};
        fsWatcher.add(this._watchPath);
        fsWatcher.on('all', (event, localPath, rawStats) => {
            this._handleFsEvents(event, localPath, rawStats);
        });
        fsWatcher.on('error', err => this._handleError(err) );
        fsWatcher.on('ready', () => this._handleReady(startTime));
        this._publish('workspace.watcher.start', this._wfsId);
        // TODO : make predicateCache smarter
        //   - reduce some 'bogus' change events that does not affect to Stats
    }

    stop() {
        if (this._fsWatcher) {
            this._publish('workspace.watcher.stop', this._wfsId);
            this._fsWatcher.close();
            this._fsWatcher = null;
            this._predicateCache = null;
        }
    }

    _createFsWatcher() {
        const opts = {
            persistent: true,
            ignoreInitial: true,
            ignorePermissionErrors : true,
            followSymlinks: false,
            atomic: false,
            // ignored is called twice, without stats and with stats.
            // see chokidar docs for detail
            ignored: path => this._isIgnoredPath(path)
        };
        return new FSWatcher(opts);
    }

    //  first call will save result to predicateCache
    //  second call will delete first result saved.
    _isIgnoredPath(path) {
        let ret = false;
        if (Object.hasOwnProperty(this._predicateCache, path)) {
            ret = this._predicateCache[path];
            delete this._predicateCache[path];
            debug(`run predicate on ${path} = ${ret} / removed cache`);
        } else {
            let shouldNotBeIgnored = this._filter(path);
            ret = this._predicateCache[path] = !shouldNotBeIgnored;
            debug(`run predicate on ${path} = ${ret} / added cache`);
        }
        return ret;
    }

    _handleError(err) {
        // in fact, we can do nothing with error.
        debug(err, `${this._wfsId} got watcher error`);
        this._publish('workspace.watcher.error', {
            wfsId : this._wfsId,
            error : err
        });
    }

    _handleReady(startTime) {
        let endTime = new Date().getTime();
        debug({
            estimatedTime: endTime - startTime,
            watchPath: this._watchPath
        }, 'ready to watch');
        this._publish('workspace.watcher.ready', {
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
            debug(eventData, 'publishing watcher event');
            this._publish('workspace.watcher.event', eventData);
        } catch (e) {
            this._handleError(e);
        }
    }
}

module.exports = Watcher;