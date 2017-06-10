const AutoDiscovery = require('./autodiscovery');
const constants = require('./constants');
const Timer = require('./timer.js');
const ObservableMemcached = require('./observable-memcached');
const Rx = require('rxjs');
const logger = require('binford-slf4j').getLogger('herdcache.js');
const MetricRecorder = require('./metricrecorder');
const CacheMetricStrings = require('./cachemetricstrings');
const CacheItem = require('./cacheitem');


const OK_PREDICATE = function(value) {
    return true;
};

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


    this.scheduleValueComputationForDisabledCache = function(key,supplier) {
        var obsy = new Rx.Observable.create(function(observer) {
            var value = supplier.subscribe(
            (value) => {
                observer.next(new CacheItem(key,value,false));
            },
            (error) => {
                observer.error(error);
            },
            null);
        });
        this.metrics.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_CACHE_DISABLED);
        return obsy.take(1).shareReplay(1);
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


function _setCacheWriteMetrics(metrics,timerMetricName, duration, counterMetricName) {
    metrics.setDuration(CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_ALL_TIMER,duration);
    metrics.setDuration(timerMetricName,duration);
    metrics.incrementCounter(counterMetricName);
}

function _completeFromSupplier(metricsReporter,memcachedClient,
                               key,observer,supplier,ttl,waitForSet,isCacheable) {
        var timer = new Timer();
        supplier.subscribe(
            (value) => {
                var isNotNullResults = value!=null;
                var isCacheableValue = isCacheable(value);
                if(isNotNullResults && isCacheableValue) {
                    metricsReporter.incrementCounter(CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE_WRITES_COUNTER);
                    if(waitForSet) {
                        memcachedClient.set(key,value,ttl,observer);
                    } else {
                        memcachedClient.set(key,value,ttl);
                        observer.next(new CacheItem(key,value,false));
                    }
                } else{
                    logger.debug("Cache Value cannot be cached.  It has to be either not null:({0}), or cachable as determine by predicate:({0}). " +
                            "Therefore, not storing in memcached", isNotNullResults, isCacheable);
                    observer.next(new CacheItem(key,value,false));
                }
                _setCacheWriteMetrics(metricsReporter,
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_SUCCESS_TIMER,
                                      timer.inspect(),
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_SUCCESS_COUNTER);
            },
            (error) => {
                observer.error(error);
                _setCacheWriteMetrics(metricsReporter,
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_TIMER,
                                      timer.inspect(),
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_COUNTER);
            },
            null);
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

/**
 * Obtain a value from the cache, or calculate it if it is not present.
 *
 * This is the preferred method of herdcache.  Whilst the return value is being calculated:
 * Either from the cache or the supplier function.  There is an observable in a internal map.
 *
 * If another call to the apply method is executed whilst another is already executing, the
 * 2nd call will not hit the cache, and instead by returned the same observable.  This way
 * many calls to the same key do not flood the cache or the upstream value services that
 * calculates a new value (in the event no item exists in the cache).
 *
 * The key must be a string, and the supplier must be a function that generates the value
 * if the item is not in the cache.
 *
 *
 * The cached value is only used if the @link #isCachedValueValid predict returns
 * return.  The Predicate evaluates the cached value, if it returns true, the cached value should be allowed,
 * otherwise the @link #computation Supplier is called to provide the value.  The @link #canCacheValueEvalutor
 * predicate is used to evaluate if the value returned by the @link #computation Supplier should be cached or not.
 * The item is stored in the cache with a TTL (time to live) that is determined by the implementation.  The default
 * is for an infinite TTL (ZERO seconds)
 *
 * @param {string} key : the name of the item against which a value is stored in the cache
 * @param {Observable} supplier : An Observable that returns a single value that is to be entered into the cache
 * @param {dict} options : List of optional settings that control how the value of the cache is treated
 * @param {boolean} options.waitForMemcachedSet : If the observe is notified of the supplier's generated value before (false : default)
 *                                                or after the memcached write has occurred (true)
 * @param {int} options.ttl : The number of seconds to store an item in the cache for (0 : the default), if store for ever
 * @param {function} options.isSupplierValueCachablePredicate : function that is given the object returned by the supplier,
 *                                                              that returns true if the value can be cached, false if not
 *                                                              (default : function that always returns true)
 * @param {function} options.isCachedValueValidPredicate : function that is given the object returned by the cache,
 *                                                         that returns true if the value can be used, or false if the supplier
 *                                                         has to be called (default : function that always returns true)
 * 
 * @return {metrics.Counter}
 */
HerdCache.prototype.apply = function(key, supplier, options) {
    options = options || {};
    var isCachedValueValidPredicate = options.isCachedValueValidPredicate || OK_PREDICATE;
    var isSupplierValueCachablePredicate = options.isSupplierValueCachablePredicate || OK_PREDICATE;
    var ttl = options.ttl || 0;
    var waitForSet = options.waitForMemcachedSet || false;

    var executingObservable = this.herdDict[key]
    if(executingObservable) {
        this.metrics.logCacheHit(key, CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION);
        return executingObservable;
    } else {
        var observable = null;
        if(!this.client.isAvailable()) {
            logger.warn("Cache is disabled");
            observable = this.scheduleValueComputationForDisabledCache(key,supplier);
        } else {
            var metricsRecorder = this.metrics;
            var memcachedClient = this.client;
            var obsy = new Rx.Observable.create(function(observer) {
                metricsRecorder.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION);

                var distributedCacheObs = memcachedClient.get(key);
                distributedCacheObs.subscribe((value) => {
                    if(value.isNotFromCache) {
                        metricsRecorder.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_ALL);
                        _completeFromSupplier(metricsRecorder,memcachedClient,
                                             key,observer,supplier,
                                             ttl,waitForSet,
                                             isSupplierValueCachablePredicate);
                    }
                    else {
                        if(isCachedValueValidPredicate(value.value)) {
                            metricsRecorder.logCacheHit(key, CacheMetricStrings.CACHE_TYPE_ALL);
                            observer.next(value);
                        } else {
                            metricsRecorder.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_ALL);
                            _completeFromSupplier(metricsRecorder,memcachedClient,
                                             key,observer,supplier,
                                             ttl,waitForSet,
                                             isSupplierValueCachablePredicate);
                        }
                    }
                },null,null);

            });
            observable = obsy.take(1).shareReplay(1);
        }

        observable.subscribe(null,null,() => {
            delete this.herdDict[key];
        });
        this.herdDict[key] = observable;
        this.metrics.logCacheMiss(key,CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION);

        return observable
    }
}


//    default public Single<CacheItem<V>> apply(String key, Supplier<V> computation, Duration timeToLive) {
//         return apply(key,computation,timeToLive,CAN_ALWAYS_CACHE_VALUE,CACHED_VALUE_IS_ALWAYS_VALID);
//     }

//     /**
//      * @param key The key to obtain/cache a value under
//      * @param computation The function that would calculate the value to be cached
//      * @param timeToLive How long the value should be cached for
//      * @param isSupplierValueCachable Should the value returned by the #computation Supplier be cached or not
//      * @return
//      */
//     default public Single<CacheItem<V>> apply(String key, Supplier<V> computation, Duration timeToLive,
//                                      Predicate<V> isSupplierValueCachable) {
//         return apply(key,computation,timeToLive,isSupplierValueCachable,CACHED_VALUE_IS_ALWAYS_VALID);
//     }

//     /**
//      * obtain a value from the cache.  The cached value is only used if the @link #isCachedValueValid predict returns
//      * return.  The Predicate evaluates the cached value, if it returns true, the cached value should be allowed,
//      * otherwise the @link #computation Supplier is called to provide the value.  The @link #canCacheValueEvalutor
//      * predicate is used to evaluate if the value returned by the @link #computation Supplier should be cached or not.
//      * The item is stored in the cache with a TTL (time to live) that is determined by the implementation.  The default
//      * is for an infinite TTL (ZERO seconds)
//      *
//      * @param key The key to obtain/cache a value under
//      * @param computation The function that would calculate the value to be cached
//      * @param isSupplierValueCachable Should the value returned by the #computation Supplier be cached or not
//      * @param isCachedValueValid Should the value returned by the cache be returned or not (and therefore the supplier called).
//      * @return
//      */
//     default Single<CacheItem<V>> apply(String key, Supplier<V> computation,
//                                       Predicate<V> isSupplierValueCachable,
//                                       Predicate<V> isCachedValueValid) {
//         return apply(key,computation,NO_TTL,isSupplierValueCachable,isCachedValueValid);
//     }

//     /**
//      * obtain a value from the cache.  The cached value is only used if the @link #isCachedValueValid predict returns
//      * return.  The Predicate evaluates the cached value, if it returns true, the cached value should be allowed,
//      * otherwise the @link #computation Supplier is called to provide the value.  The @link #canCacheValueEvalutor
//      * predicate is used to evaluate if the value returned by the @link #computation Supplier should be cached or not.
//      *
//      * @param key The key to obtain/cache a value under
//      * @param computation The function that would calculate the value to be cached
//      * @param timeToLive How long the value should be cached for
//      * @param isSupplierValueCachable Should the value returned by the #computation Supplier be cached or not
//      * @param isCachedValueValid Should the value returned by the cache be returned or not (and therefore the supplier called).
//      * @return
//      */
//     public Single<CacheItem<V>> apply(String key, Supplier<V> computation, Duration timeToLive,
//                                      Predicate<V> isSupplierValueCachable,
//                                      Predicate<V> isCachedValueValid);


module.exports = HerdCache;
