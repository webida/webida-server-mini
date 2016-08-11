'use strict';

const { _ } = __webida.libs;

const AbstractComponent = require('./../AbstractComponent.js');

class AliasRegistry extends AbstractComponent {

    constructor(logger, eventBus, config) {
        super(logger, eventBus, {
            stop: ['http-service']
        });
        this.aliases = [];
        this.pathIndex = {};
    }

    _getPersistence() {
        return _.values(this.aliases);
    }

    _setPersistence(persistence) {
        persistence.forEach(alias => this.put(alias));
    }

    get(aliasId) {
        return this.aliases[aliasId];
    }

    put(alias) {
        this.logger.debug(alias, 'put alias');
        this.aliases[alias.id] = alias;
        this.pathIndex[alias.sourcePath] = alias.id;
    }

    remove(aliasId) {
        let alias = this.aliases[aliasId];
        delete this.aliases[aliasId];
        delete this.pathIndex[alias.sourcePath];
        this.logger.debug({alias}, 'removed alias');
        return alias;
    }

    find(aliasId, workspaceId, srcPath) {
        let result = [];
        let addToResult = (alias) => {
            if (alias) {
                result.push(alias);
            }
        };

        if (aliasId !== '*') {
            addToResult(this.get(aliasId));
            return result;
        }
        if (srcPath && srcPath !== '*') {
            addToResult(this.getBySourcePath(srcPath));
            return result;
        }

        if (!workspaceId || workspaceId === '*') {
            return _.values(this.aliases);
        }
        result = _(this.aliases).chain()
            .pickBy(alias => alias.workspaceId === workspaceId )
            .values();
        return result;
    }

    // get by source path
    getBySourcePath(srcPath) {
        let aid = this.pathIndex[srcPath];
        if (aid) {
            return this.get(aid);
        }
    }
}


module.exports = AliasRegistry;