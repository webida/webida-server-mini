'use strict';

const { assert, path, _ , debugFactory } = __webida.libs;
const debug = debugFactory(module);

const AbstractComponent = require('./AbstractComponent.js');

const BUILTIN_COMPONENT_CLASS_PATH = (className) => path.resolve(__dirname, 'components', className);

const BUILTIN_COMPONENTS = {
    AliasRegistry: BUILTIN_COMPONENT_CLASS_PATH('AliasRegistry'),
    Authenticator: BUILTIN_COMPONENT_CLASS_PATH('Authenticator'),
    HttpService: BUILTIN_COMPONENT_CLASS_PATH('HttpService'),
    SessionRegistry: BUILTIN_COMPONENT_CLASS_PATH('SessionRegistry'),
    SocketService: BUILTIN_COMPONENT_CLASS_PATH('SocketService'),
    TokenFactory: BUILTIN_COMPONENT_CLASS_PATH('TokenFactory'),
    WorkspaceRegistry: BUILTIN_COMPONENT_CLASS_PATH('WorkspaceRegistry')
};


class ComponentRegistry {
    constructor(builtinComponents) {
        this._components = {};
        this._resolve = this.getComponent.bind(this);
    }

    init(config, logger, eventBus) {
        try {
            let catalog = _.defaults({}, config.components || {}, BUILTIN_COMPONENTS);
            this._catalog = catalog;
            _.values(this._catalog).forEach(loadable =>
                this.createComponent(loadable, logger, eventBus));
        } catch (e) {
            debug(e, 'component registry initialization failed');
            throw e;
        }
    }

    createComponent(classModulePath, logger, eventBus) {
        let ModuleConstructor = require(classModulePath);
        let instance = new ModuleConstructor(logger, eventBus);
        this.addComponent(instance);
        return instance;
    }

    addComponent(component, ignoreDuplicated) {
        assert(component.id, 'component should have id');
        if (this._components[component.id]) {
            if (!ignoreDuplicated) {
                throw new Error('duplicated component id ' + component.id);
            } else {
                debug('ignores duplicated component id ' + component.id);
            }
        } else {
            this._components[component.id] = component;
            component.resolve = this._resolve;
        }
    }

    getComponent(componentId) {
        return this._components[componentId];
    }

    // some components and server may want to get 'all' components.
    // using generator is fun, but they have to manage some 'masks'
    createMask(initialValue, ...componentIds) {
        let ids = componentIds.length > 0 ? componentIds : Object.keys(this._components);
        let ret = {};
        ids.forEach( id => {
            ret[id] = typeof(initialValue) === 'function' ? initialValue(id) : initialValue;
        });
        return ret;
    }

    get components() {
        return this._components;
    }

    get catalog() {
        return this._catalog;
    }
}

module.exports = ComponentRegistry;
