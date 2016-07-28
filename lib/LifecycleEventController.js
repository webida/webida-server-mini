'use strict';

const LifecycleEventHandler = require('./LifecycleEventController.js');

class LifecycleEventController {
    constructor(owner, eventBus, ... dependencies ) {
        this.handlers = { };
        LifecycleEventHandler.LIFECYCLE_EVENTS.forEach(eventName => {
            let handler = new LifecycleEventHandler(owner, eventName,
                owner[eventName], dependencies);
            handler.attachTo(eventBus);
            this.handlers[eventName] = handler;
        });
    }
}

module.exports = LifecycleEventController;
