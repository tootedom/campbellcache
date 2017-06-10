const AutoDiscovery = require('./autodiscovery');
const constants = require('./constants');
const Timer = require('./timer.js');
const ObservableMemcached = require('./observable-memcached');
const Rx = require('rxjs');
const logger = require('binford-slf4j').getLogger('herdcache.js');
const MetricRecorder = require('./metricrecorder');
const CacheMetricStrings = require('./cachemetricstrings');


function HerdCache(options) {
    options.autodiscovery = options.autodiscovery || false;
    options.autodiscovery_timeout = options.timeout;
    options.autodiscovery_interval = options.autodiscovery_interval;
    options.memcached_opts = options.memcached_opts || {};
    this.autodiscovery_enabled = options.autodiscovery;

    this.metrics = new MetricRecorder({
        prefix: options.metrics_prefix || null,
        server: options.metrics_server || null
    });



    this.client = this._observableMemcacheFactory([],options);
    this.herdDict = {};


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
    var cachedLookup = this.herdDict[key]
    if(cachedLookup) {
        this.metrics.logCacheHit(key, CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION);
        logger.debug("Existing GET request running for key: '{0}', returning existing observable",key);
        return cachedLookup;
    } else {
        this.metrics.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION);
        var timer = new Timer();
        return this.client.get(key)
    }
}


module.exports = HerdCache;
