
const MemcachedClient = require('memcached');
const Rx = require('rxjs');

function ObservableMemcached(enabled, hosts, opts) {
    this.enabled = enabled;
    var options = opts || {};
    this.client = new MemcachedClient(
        hosts,
        {
            timeout: options.timeout || 2500,
            poolSize: options.poolSize || 10,
            retries: options.retries || 0,
            reconnect: options.reconnect || 120000
        }
    )

    return this;
}

ObservableMemcached.prototype.isAvailable = function() {
    return this.enabled;
}

ObservableMemcached.prototype.get = function(key) {
    var client = this.client;
    if(this.enabled) {
        var obsy = new Rx.Observable.create((observer) => {;
            // setTimeout(() => {
            client.get(key,function(err,data) {
                if(err) {
                    observer.next(null);
                } else {
                    observer.next(data);
                }
                observer.complete();
            });
            // },2000);
        });

        return obsy.take(1).shareReplay(1);
    } else {
        return new Rx.Observable.of(null).take(1);
    }
}

module.exports = ObservableMemcached;


