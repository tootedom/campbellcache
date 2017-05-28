const logger = require('binford-slf4j').getLogger('observable-memcached.js');
const MemcachedClient = require('memcached');
const Rx = require('rxjs');
const CacheItem = require('./cacheitem');

function ObservableMemcached(enabled, hosts, opts) {
    // If no hosts, cannot be enabled
    if(hosts && hosts.length>0) {
        this.enabled = enabled;
    } else {
        this.enabled = false;
    }
    // only create client if hosts is set as enabled
    if(enabled) {
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
    }
    return this;
}

ObservableMemcached.prototype.isAvailable = function() {
    return this.enabled;
}

ObservableMemcached.prototype.get = function(key) {
    var client = this.client;
    if(this.enabled) {
        logger.debug('Cache Enabled');
        var obsy = new Rx.Observable.create((observer) => {;
            client.get(key,function(err,data) {
                if(err) {
                    logger.debug("Error when fetching from cache {0}",err);
                    observer.next(new CacheItem(key,null,false));
                } else {
                    if(data) {
                        logger.debug("Cache hit for key: '{0}'",key);
                        observer.next(new CacheItem(key,data,true));
                    } else {
                        logger.debug("Cache Miss for key: '{0}'",key);
                        observer.next(new CacheItem(key,null,false));
                    }
                }
                observer.complete();
            });
        });

        return obsy.take(1).shareReplay(1);
    } else {
        logger.debug("Cache Disabled");
        return new Rx.Observable.of(new CacheItem(key,null,false)).take(1);
    }
}

ObservableMemcached.prototype.shutdown = function() {
    if(this.client) {
        this.client.end();
    }
    this.enabled = false;
}

module.exports = ObservableMemcached;


