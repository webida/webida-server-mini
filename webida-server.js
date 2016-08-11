"use strict";

require('./lib/init/init-process.js');
const { debugFactory } = __webida.libs;
const debug = debugFactory(module);

const WebidaServer = require('./lib/WebidaServer.js');
const server = new WebidaServer();

server.init()
    .then( () => {
        debug('server init complete');
        return server.start();
    })
    .then( () => {
        debug('server start complete ');
    }
).catch( (e) => {
    debug(e, 'server could not start ');
    process.exit(-1);
});

// for windows, we may need some other channel like named pipe
//  we should create lib/server-controller.js for windows

// signal handlers 
//  - SIGHUP : restart server
//  - SIGTERM : stop, destroy server & shutdown 
