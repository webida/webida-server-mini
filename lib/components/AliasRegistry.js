'use strict';

const { _ } = __webida.libs;

const AbstractComponent = require('./../AbstractComponent.js');

class AliasRegistry extends AbstractComponent {

    constructor(server) {
        super('alias-registry', ['aliases'], server);
        this.aliases = {};
    }

    get(aliasId) {
        return this.aliases[aliasId];
    }

    put(alias) {
        this.logger.debug(alias, 'add alias');
        this.aliases[alias.id] = alias;
    }

    remove(aliasId) {
        let alias = this.aliases[aliasId];
        delete this.aliases[aliasId];
        this.logger.debug({alias}, 'removed alias');
        return alias;
    }

    // returns alias list, not map.
    getByWorkspaceId(workspaceId) {
        return _(this.aliases).chain()
            .pickBy( alias => alias.workspaceId === workspaceId )
            .values();
    }

    // removes all, returns nothing
    removeByWorkspaceId(workspaceId) {
        let targets = _.pickBy(this.aliases, (alias) => alias.workspaceId === workspaceId );
        Object.keys(targets).forEach( target => this.remove(target) );
        return targets;
    }
}


module.exports = AliasRegistry;