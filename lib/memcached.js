
const MemcachedClient = require('memcached');
const Rx = require('rxjs');

// import { Observable, ReplaySubject } from 'rxjs';

Rx.Observable.prototype.cache = function cache(
    keySelector,
    project,
    evictionSelector = () => Rx.Observable.never(),
    map = {}) {
    return this.groupBy(
        keySelector,
        (element) => element,
        (elements) => evictionSelector(elements)
            .ignoreElements()
            .finally(() => {
              console.log(`forgetting ${elements.key}`);
              delete map[elements.key];
            })
    )
    .mergeMap((elements) =>
        map[elements.key] || (
        map[elements.key] = project(elements)));
}


function Memcached(enabled, hosts, opts) {
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

Memcached.prototype.isAvailable = function() {
    return this.enabled;
}

Memcached.prototype.get = function(key) {
    var client = this.client;
    if(this.enabled) {
        var obsy = new Rx.Observable.create((obs) => {;
            setTimeout(() => {
            client.get(key,function(err,data) {
                if(err) {
                    obs.next(null);
                } else {
                    obs.next(data);
                }
                
            })
            },2000);
        });

        return obsy.take(1).shareReplay(1);
        // return obsy.cache((value) => value,
        // (values) => {
        //     return values
        //         .multicast(new Rx.ReplaySubject())
        //         .refCount()
        // });
        
    } else {
        return new Rx.Observable.of(null).take(1);
    }
}

module.exports = Memcached;


