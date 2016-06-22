'use strict';

const { assert, path } = __webida.libs;
const AbstractComponent = require('./components/AbstractComponent.js');

class ComponentFactory {
    constructor(server) {
        this._server = server;
        this._components = {};
        this.catalog = {};  // class name -> absolute path
    }

    createComponent(className) {
        assert(!this._components[className], `duplicated component class ${className}`);
        let classModulePath = this.catalog[className] ||
            path.resolve(__dirname, 'components', className + '.js');

        // eslint-disable-next-line global-require
        let ModuleConstructor = require(classModulePath);
        this._components[className] = new ModuleConstructor(this._server);

        return this._components[className];
    }

    getComponent(className) {
        let ret = this._components[className];
        assert(ret instanceof AbstractComponent, `component not found ${className}`);
        return ret;
    }
}

module.exports = ComponentFactory;
