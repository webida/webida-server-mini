"use strict";

require('./lib/init/init-process.js');
const { debugFactory } = __webida.libs;
const debug = debugFactory(module);

const WebidaServer = require('./lib/WebidaServer.js');
const server = new WebidaServer();

server.init().then(
    () => server.start()
).then(
    () => {
        // add some signal handler
        //   SIGTERM - stop server and exit process
        //   SIGHUP - restart server and continue
        debug('server started ');
    }
).catch( (e) => {
    debuug(e, 'server could not start ');
    process.exit(-1);
});

// for windows, we may need some other channel like named pipe
//  we should create lib/server-controller.js for windows

// signal handlers 
//  - SIGHUP : restart server
//  - SIGTERM : stop, destroy server & shutdown 
