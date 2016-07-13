"use strict";

const WebidaServer = require('./lib/WebidaServer.js');
const server = new WebidaServer();

server.init().then(
    () => server.start()
).then(
    () => {
        // add some signal handler
        //   SIGTERM - stop server and exit process
        //   SIGHUP - restart server and continue
        console.log('server started ');
    }
).catch( (e) => {
    console.error('server could not start ', e);
    process.exit(-1);
});

// for windows, we may need some other channel like named pipe
//  we should create lib/server-controller.js for windows

// signal handlers 
//  - SIGHUP : restart server
//  - SIGTERM : stop, destroy server & shutdown 

