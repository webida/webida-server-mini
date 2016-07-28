'use strict'

// Although using 'deferred' object that wraps a promise (to fulfill it at
// somewhere other than the constructor) is regarded as an anti-pattern.
// But, sometimes, we still need it to handle some complex events. see
// Lifecycle Event Handler, for example.

class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}

module.export = Deferred;
