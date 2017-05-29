const AutoDiscovery = require('./autodiscovery');
const constants = require('./constants');
const Timer = require('./timer.js');
const ObservableMemcached = require('./observable-memcached');
const Rx = require('rxjs');
const logger = require('binford-slf4j').getLogger('herdcache.js');
const MetricRecorder = require('./metricrecorder');


function HerdCache(options) {
    options.autodiscovery = options.autodiscovery || false;
    options.autodiscovery_timeout = options.timeout;
    options.autodiscovery_interval = options.autodiscovery_interval;
    options.memcached_opts = options.memcached_opts || {};

    this.autodiscovery_enabled = options.autodiscovery;
    this.client = this._observableMemcacheFactory([],options);
    this.herdApplyDict = {};
    this.herdGetDict = {};
    this.metrics = new MetricRecorder();

    if(options.autodiscovery) {
        this.autodiscovery = new AutoDiscovery({
            url: options.autodiscovery_url,
            intervalInMs: options.autodiscovery_interval,
            timeout: options.autodiscovery_timeout,
        });
        this.autodiscovery.register(_updateClient(this,options.memcached_opts));
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
        if(hosts) {
            logger.debug("Notified of newly discovered host list: {0}",hosts);
            cache.client = cache._observableMemcacheFactory(hosts,opts);
        } else {
            logger.debug("Empty set of the hosts discovered");
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
    this.metrics.incMethodCounter('get');
    var cachedLookup = this.herdGetDict[key]
    if(cachedLookup) {
        logger.debug("Existing GET request running for key: '{0}', returning existing observable",key);
        return cachedLookup;
    } else {
        var timer = new Timer();
        var single = this.client.get(key)
        this.herdGetDict[key] = single;
        logger.debug("Looking up '{0}' in cache, Observable Added to lookup cache",key);

        // Add remove observer
        single.subscribe(null,null,() => {
            delete this.herdGetDict[key];
            logger.debug("Cache Lookup for key '{0}' finished executing in '{1}ms', removing observable from lookup cache",key,timer);
        });

        return single;
    }
}


module.exports = HerdCache;
