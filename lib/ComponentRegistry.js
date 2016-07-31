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

    constructor(eventBus) {
        this._components = {};
        this._eventBus = eventBus;
        this._lookup = this.getComponent.bind(this);
    }

    init(logger, config) {
        try {
            let catalog = _.defaults({}, config.components || {}, BUILTIN_COMPONENTS);
            let createAndAdd = classModulePath => {
                let ModuleConstructor = require(classModulePath);
                let instance = new ModuleConstructor(logger, eventBus, config);
                this.addComponent(instance);
            };
            _.values(catalog).forEach(modPath => createAndAdd(modPath));
        } catch (e) {
            debug(e, 'component registry initialization failed');
            throw e;
        }
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
            component.lookup = this._lookup;
        }
    }

    getComponent(componentId) {
        return this._components[componentId];
    }

    getComponentIds() {
        return Object.keys(this._components);
    }

    destroy() {
        // this._lookup = null possibly can break component's work
        this._eventBus = {};
        this._components = {};
    }
}

module.exports = ComponentRegistry;
