'use strict';

// code came from swaggerize-restify(https://github.com/bardzusny/swaggerize-restify)
// with heavy rewriting. this file is not a fork anymore, for it's impossible to merge
// changes from original project.

const {assert, path, debugFactory, restify, thing } = __webida.libs;

const async = require('async'), 
    swaggerizeRoutes = require('./../.././swaggerize-routes/lib/index'),
    routingPathUtils = require('./../.././swaggerize-routes/lib/utils');

const debug = debugFactory(module);

function swaggerize(server, options) {
    assert.ok(thing.isObject(options), 'Expected options to be an object.');
    assert.ok(thing.isObject(options.api), 'Expected an api definition object.');
    options.basedir = options.basedir || path.resolve(__dirname, 'api');
    let routeSpecs = swaggerizeRoutes(options);
    registerRestifyRoutes(server, routeSpecs || [],  options);
    debug('registered all swaggerized routes');
    return server;
}

function registerRestifyRoutes(server, routeSpecs, options) {
    let mountpath = routingPathUtils.unsuffix(options.api.basePath, '/');
    options.docspath = routingPathUtils.prefix(options.docspath || '/api-docs', '/');
    options.api.basePath = routingPathUtils.prefix(options.api.basePath || '/', '/');

    server.get(mountpath + options.docsPath,
        function swaggerApiDocHandler(req, res, next) {
            res.json(200, options.api);
            next();
        }
    );

    routeSpecs.forEach(function(routeSpec) {
        registerRoute(server, mountpath, routeSpec);
    });
}

/**
 * Makes default accessor functions for a specific data location, e.g. query, params etc
 * @param dataLoc
 * @warn We forces the parameter should have unique name across locations. So, every
 *       accessor sets a value to req.params too, regardless its orginal location
 *       So, including body or header parameters, all parameters are accessible 
 *       with req.params. 
 * @returns {{get: get, set: set}}
 */
function defaultAccessor(dataLoc) {
    return {
        get: function(req, key) {
            // with restify, body params can be available
            // in req.params (not necessarily req.body)
            if (dataLoc === 'body' && !req.body) {
                dataLoc = 'params';
            }
            return req[dataLoc][key];
        },
        set: function(req, key, val) {
            if (dataLoc === 'body' && !req.body) {
                dataLoc = 'params';
            }
            req[dataLoc][key] = val;
            // WARNING - OUT OF OAI SPEC. parameter 'name' must be unique in scope. 
            if (dataLoc !== 'params') {
                req.params[key] = val;
            }
        }
    };
}

function valueAccessor(param) {
    if (param.in === 'path') {
        return defaultAccessor('params');
    }
    if (param.in === 'query') {
        return defaultAccessor('query');
    }
    if (param.in === 'header') {
        return {
            get: (req, key) => req.headers[key.toLowerCase()],
            // header parameters are accessible via req.params, too.
            set: (req, key, val) => { req.params[key.toLowerCase()] = val; }
        };
    }
    
    if (param.in === 'body') {
        return {
            get: function(req) {
                return req.body || req.params;
            },
            set: function(req, key, val) {
                if (req.body) {
                    req.body = val;
                    req.params[key] = val; 
                } else {
                    // prevent overwriting of path params, also in req.params
                    Object.keys(val).forEach(function(valKey) {
                        req.params[valKey] = val[valKey];
                    });
                }
            }
        };
    }
    
    if (param.in === 'formData') {
        return {
            get: function(req, key) {
                let params = req.params || {};
                let body = req.body || {};
                let files = req.files || {};
                return params[key] || body[key] || files[key] || undefined;
            },
            set: function(req, key, val) {
                // as default accessor, form data access will overwrite req.params.
                req.params[key] = val;
                if (typeof req.body === 'object') {
                    req.body[key] = val;
                }
                if (param.type === 'file' && typeof req.files === 'object') {
                    req.files[key] = val;
                }
            }
        };
    }
}


/**
 * Makes a validator function, to validate data input per the Swagger API spec.
 * @param {{}} validator
 * @param {array} consumes
 * @returns {function}
 */
function makeValidator(validator, consumes) {

    let parameter = validator.parameter;
    let validate = validator.validate;

    function validateInput(req, res, next) {

        let accessor = valueAccessor(parameter, consumes);
        let value = accessor.get(req, parameter.name);

        // swaggerize-routes validate seems to have bug (cannot handle buffer/file from restify
        //  we should not validate it if we're dealing form-data request
        if (parameter.in === 'formData' && parameter.type === 'file') {
            accessor.set(req, parameter.name, value);
            return next();
        }

        validate(value, function (error, newvalue) {
            if (error) {
                next(new restify.BadRequestError(error.message));
                return;
            }
            accessor.set(req, parameter.name, newvalue);
            next();
        });
    }

    return validateInput;
}


/**
 * Creates a route to server with given mount path
 * @param server
 * @param mountpath
 * @param routeSpec
 */
function registerRoute(server, mountpath, routeSpec) {
    let path, args, before, validators, paramSpecs = {};

    if (thing.isArray(routeSpec.validators)) {
        routeSpec.validators.forEach( (validator) => {
            if (validator.parameter) {
                paramSpecs[validator.parameter.name] = validator.parameter;
            }
        });
    }

    path = routeSpec.path.replace(/{([^}]+)}/g, function(match) {
        let paramName = match.slice(1,-1);
        let paramSpec = paramSpecs[paramName];

        let restifyPathFragment = ':' + paramName;
        if (paramSpec && paramSpec.pattern) { // falsy paramSpec means missing validator
            restifyPathFragment = restifyPathFragment + '(' + paramSpec.pattern + ')';
        }
        return restifyPathFragment;
    });

    args = [mountpath + routingPathUtils.prefix(path, '/')];
    before = [];

    if (routeSpec.security) {
        before.push(authorizeFor(routeSpec.security));
    }

    validators = [];
    for (let i = 0; i < routeSpec.validators.length; ++i) {
        validators.push(makeValidator(routeSpec.validators[i], routeSpec.consumes));
    }
    before = before.concat(validators);

    if (thing.isArray(routeSpec.handler)) {
        if (routeSpec.handler.length > 1) {
            Array.prototype.push.apply(before, routeSpec.handler.slice(0, routeSpec.handler.length - 1));
        }
        routeSpec.handler = routeSpec.handler[routeSpec.handler.length - 1];
    }

    Array.prototype.push.apply(args, before);
    // TODO : wrap handler with a function that handles error thrown. 
    
    args.push(routeSpec.handler);
    if (routeSpec.method === 'delete') {
        routeSpec.method = 'del';
    }
    
    debug({
        method : routeSpec.method,
        args : args
    }, 'registering swaggerized route');

    server[routeSpec.method].apply(server, args);
}

function authorizeFor(security) {

    // TODO : repalce async with Promise
    return function authorize(req, res, next) {
        let errors = [];

        function passed(type, pass) {
            if (thing.isFunction(security[type].authorize)) {
                req.requiredScopes = security[type].scopes;
                security[type].authorize(req, res, function (error) {
                    if (error) {
                        errors.push(error);
                        pass(false);
                        return;
                    }
                    pass(true);
                });
            } else {
                res.statusCode = 500;
                errors.push(new Error('Unimplemented authorization ' + type));
                pass(false);
            }
        }

        function done(success) {
            if (!success) {
                next(errors.shift());
                return;
            }
            next();
        }

        async.some(Object.keys(security), passed, done);
    };
}

module.exports = swaggerize;


