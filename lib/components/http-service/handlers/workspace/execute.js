'use strict';

const { restify } = __webida.libs;
const { exec } = require('child_process');
const helper = require('../../helper.js')(module);

const EXEC_TIMEOUT = 60000;
const EXEC_MAX_BUFFER = 524288;

function execute(req, res, next) {
    const finish = helper.createFinisher(req, res, next);
    try {
        let workspace = helper.resolveWorkspace(req);

        if (req.params.async) {
            return finish(new restify.ServiceUnavailableError("not implemented yet"));
        }

        let execution = req.body;
        let execCommand = execution.command + ' ' + execution.args.join(' ');

        let execOptions = {
            cwd: workspace.resolvePath(execution.cwd),
            env: execution.env || undefined,
            timeout : execution.timeout || EXEC_TIMEOUT,
            maxBuffer: execution.maxBuffer || EXEC_MAX_BUFFER
        };

        req.log.debug(execOptions, `execution command : ${execCommand}`);

        // recent node.js documentation is missing err.code & err.signal.
        // anyway, they are still reachable.
        let childProc = exec(execCommand, execOptions, (err, stdout, stderr) => {
            let result = {
                error: err ? err.toString() : '',
                stdout,
                stderr,
                code: err ? err.code : 0,
                signal: err ? err.signal : undefined
            };
            req.log.debug(result, 'exec completed');
            return finish(result);
        });

        // TODO: create ChildProc from node.js child proce & execute object
        //  we may need ChildProc model class.

        // documentation says error comes with error object.
        childProc.on('error', (err) => {
            req.log.error(err, 'exec child process error');
        });

        childProc.on('exit', (code, signal) =>{
            req.log.debug({code,signal}, 'exec child process exited');
            // TODO : remove child proc from the workspace
        });

    } catch(e) {
        return finish(e);
    }
}

module.exports = {
    'post' : execute
};
