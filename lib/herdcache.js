const AutoDiscovery = require('./autodiscovery');
const constants = require('./constants');
const ObservableMemcached = require('./observable-memcached');
const Rx = require('rxjs');

function HerdCache(options) {
    options.autodiscovery = options.autodiscovery || false;
    options.autodiscovery_timeout = options.timeout;
    options.autodiscovery_interval = options.autodiscovery_interval;
    options.memcached_opts = options.memcached_opts || {};

    this.autodiscovery_enabled = options.autodiscovery;
    this.client = this._observableMemcacheFactory([],options);
    this.herdApplyDict = {};
    this.herdGetDict = {};

    console.log(options);
    if(options.autodiscovery) {
        this.autodiscovery = new AutoDiscovery({
            url: options.autodiscovery_url,
            intervalInMs: options.autodiscovery_interval,
            timeout: options.autodiscovery_timeout,
        });
        this.autodiscovery.register(_updateClient(this,options.memcached_opts));
        console.log(this.autodiscovery);
    } else {
        options.endpoints = _parseEndpoint(options.endpoint);

        if(options.endpoints.length==0) {
            // Sort out the no operation client
            throw new Error("No memcmached endpoints defined.  No Op Client is going to be defined!");
        }
    }

    return this;
};

function _updateClient(herdcache,memcached_opts) {
    var cache = herdcache;
    var opts = memcached_opts;
    return function(hosts) {
        console.log("Running Client update Function");
        if(hosts) {
            cache.client = cache._observableMemcacheFactory(hosts,opts);
            cache.client.get("key",(err,de) => {
                console.log("GETTING" + de);
            })
        } else {
            cache.client = cache._observableMemcacheFactory([],opts);
        }
    }
}


function _parseEndpoint(endpoint) {
    if (endpoint) {
        if (Array.isArray(options.endpoints)) {
            return options.endpoints
        } else {
            return [options.endpoints]
        }
    } else {
        return [];
    }
}

HerdCache.prototype._observableMemcacheFactory = function (hosts,options) {
    return new ObservableMemcached(true,hosts,options);
}

HerdCache.prototype.shutdown = function() {
    if(this.autodiscovery_enabled) {
        // stop autodiscovery
        if(this.autodiscovery) {
            this.autodiscovery.shutdown();
        }
    }

    if(this.client) {
        this.client.shutdown();
    }
}


HerdCache.prototype.get = function(key) {
    var cachedLookup = this.herdGetDict[key]
    if(cachedLookup) {
        return cachedLookup;
    } else {
        var single = this.client.get(key)
        this.herdGetDict[key] = single;

        // Add remove observer
        single.subscribe(null,null,() => {
            delete this.herdGetDict[key];
            console.log("removed key:"+key);
        });

        return single;
    }
}


module.exports = HerdCache;
