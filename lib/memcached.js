const MemcachedClient = require('memcached');

function Memcached(enabled, hosts, opts) {
    this.enabled = enabled;
    var options = opts || {};
    this.client = new MemcachedClient({
        hosts: hosts,
        timeout: options.timeout || 2500,
        poolSize: options.poolSize || 10,
        retries: options.retries || 0,
        reconnect: options.reconnect || 120000
    })

    return this;
}

Memcached.prototype.isAvailable = function() {
    return this.enabled;
}

 function g(key,timeout) {
    var promise = this.client.get(key);
    promise.timeout(timeout);
    promise.then(function(val) {
        return val
    },
    function(err) {
        return null;
    })

    ;
}

Memcached.prototype.get = function(key,timeout) {
    if(this.enabled) {

    } else {
        return null;
    }
    
}

module.exports = Memcached;


