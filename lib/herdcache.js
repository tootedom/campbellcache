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

function getOrDefault(val,defaultVal) {
    return (typeof val !== 'undefined') ? val : defaultVal;
}

function HerdCache(options) {
    var opts = {};
    opts.autodiscovery = getOrDefault(options.autodiscovery,true);
    opts.autodiscovery_timeoutInMs = options.autodiscovery_timeoutInMs;
    opts.autodiscovery_intervalInMs = options.autodiscovery_intervalInMs;
    opts.autodiscovery_oldClientTTL = options.autodiscovery_oldClientTTL || 120000;
    opts.memcached_opts = getOrDefault(options.memcached_opts, {});
    opts.hosts = options.hosts || [];

    this.autodiscovery_enabled = options.autodiscovery;

    this.metrics = new MetricRecorder({
        prefix: getOrDefault(options.metrics_prefix,null),
        registries: getOrDefault(options.metrics_registries,null)
    });


    opts.memcached_opts.memcached = opts.memcached_opts.memcached || {};

    opts.memcached_opts.metricsrecorder = this.metrics;


    this.client = this._observableMemcacheFactory(opts.hosts,opts.memcached_opts);
    this.herdDict = {};

    if(options.autodiscovery) {
        this.autodiscovery = new AutoDiscovery({
            url: options.autodiscovery_url,
            intervalInMs: options.autodiscovery_intervalInMs,
            timeoutInMs: options.autodiscovery_timeoutInMs,
        });
        this.autodiscovery.register(_updateClient(this,opts.memcached_opts,
                                                  opts.autodiscovery_oldClientTTL));
    } else {
        opts.hosts = _parseEndpoint(opts.hosts);

        if(opts.hosts.length==0) {
            // Sort out the no operation client
            throw new Error("No memcmached endpoints defined.  No Op Client is going to be defined!");
        }
    }


    this.scheduleValueComputationForDisabledCache = function(key,supplier,observableDict) {
        var obsy = new Rx.Observable.create(function(observer) {
            var observableSupplier = null;
            try {
                observableSupplier = supplier();
            } catch(err) {
                observer.error(err)
                observer.complete();
                delete observableDict[key];
                // _setCacheWriteMetrics(metricsReporter,
                //                         CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_TIMER,
                //                         timer.inspect(),
                //                         CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_COUNTER);
                return null;
            }
            var sub = observableSupplier.subscribe(
                (value) => {
                    observer.next(new CacheItem(key,value,false));
                    observer.complete();
                    delete observableDict[key];
                },
                (error) => {
                    observer.error(error);
                    observer.complete();
                    delete observableDict[key];
                },
                null);

            return _ => {
                sub.unsubscribe();
            };
        });
        this.metrics.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_CACHE_DISABLED);
        return obsy.take(1).shareReplay(1);
    }

    return this;
};

function _updateClient(herdcache,memcached_opts,oldClientTTL) {
    var cache = herdcache;
    var opts = memcached_opts;
    var shutdownTTL = oldClientTTL;
    return function(hosts) {
        var oldClient = herdcache.client;
        if(hosts) {
            logger.debug("Notified of newly discovered host list: {0}",hosts);
            cache.client = cache._observableMemcacheFactory(hosts,opts);
        } else {
            logger.debug("Empty set of the hosts discovered");
            cache.client = cache._observableMemcacheFactory([],opts);
        }
        setTimeout(() => {
            oldClient.shutdown();
            logger.debug("Shutdown old client");
        },shutdownTTL);
    }
}


function _parseEndpoint(endpoints) {
    if (endpoints) {
        if (Array.isArray(endpoints)) {
            return endpoints
        } else {
            return [endpoints]
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
                               key,observer,supplier,ttl,waitForSet,isCacheable,
                               observableCache) {
        var timer = new Timer();
        var observableSupplier = null;
        try {
            observableSupplier = supplier();
        } catch(err) {
            observer.error(err)
            observer.complete();
            delete observableCache[key];
            _setCacheWriteMetrics(metricsReporter,
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_TIMER,
                                      timer.inspect(),
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_COUNTER);
            return null;
        }

        const sub = observableSupplier.subscribe(
            (value) => {
                logger.debug("value :" +value);
                var isNotNullResults = value!=null;
                var isCacheableValue = isCacheable(value);
                if(isNotNullResults && isCacheableValue) {
                    metricsReporter.incrementCounter(CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE_WRITES_COUNTER);
                    if(waitForSet) {
                        memcachedClient.set(key,value,ttl,observer);
                    } else {
                        memcachedClient.set(key,value,ttl);
                        observer.next(new CacheItem(key,value,false));
                        observer.complete();
                    }
                    delete observableCache[key];
                } else{
                    logger.debug("Cache Value cannot be cached.  It has to be either not null:({0}), or cachable as determine by predicate:({0}). " +
                            "Therefore, not storing in memcached", isNotNullResults, isCacheable);
                    observer.next(new CacheItem(key,value,false));
                    observer.complete();
                    delete observableCache[key];
                }
                _setCacheWriteMetrics(metricsReporter,
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_SUCCESS_TIMER,
                                      timer.inspect(),
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_SUCCESS_COUNTER);
            },
            (error) => {
                observer.error(error);
                observer.complete();
                delete observableCache[key];
                _setCacheWriteMetrics(metricsReporter,
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_TIMER,
                                      timer.inspect(),
                                      CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_COUNTER);
            });
        return sub;
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
        return cachedLookup;
    } else {
        this.metrics.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION);
        return this.client.get(key);
    }
}

/**
 * Sets a value in the cache from the given supplier.
 * This method always forces the setting of a value to the cache (if it is deemed cacheable).
 *
 * The internal cache that contains observables will be replaced by this running supplier,
 * so any other call to apply and get will be supplied this observable.
 *
 * The key must be a string, and the supplier must be an Observable that generates the value
 * that is to be place in the cache
 *
 * the options.isSupplierValueCachablePredicate predicate is used to evaluate if the value
 * returned by the @link #supplier Observable should be cached or not.
 *
 * The item is stored in the cache with a TTL (time to live) that is determined by the caller.
 * The default is for an infinite TTL (ZERO seconds)
 *
 * @param {string} key : the name of the item against which a value is stored in the cache
 * @param {Observable} supplier : An Observable that returns a single value that is to be entered into the cache
 * @param {dict} options : List of optional settings that control how the value of the cache is treated
 *
 * @param {boolean} options.waitForMemcachedSet : If the observe is notified of the supplier's generated value before (false : default)
 *                                                or after the memcached write has occurred (true)
 * @param {int} options.ttl : The number of seconds to store an item in the cache for (0 : the default), if store for ever
 * @param {function} options.isSupplierValueCachablePredicate : function that is given the object returned by the supplier,
 *                                                              that returns true if the value can be cached, false if not
 *                                                              (default : function that always returns true)
 *
 * @return {Observable} An observable that will return a CacheItem; which will be either
 *                      a value from the cache or a value generated from the give supplier
 */
HerdCache.prototype.set = function(key,supplier,options) {
    options = options || {};
    var observable = null;
    const isSupplierValueCachablePredicate = options.isSupplierValueCachablePredicate || OK_PREDICATE;
    const ttl = options.ttl || 0;
    const waitForSet = options.waitForMemcachedSet || false;

    if(!this.client.isAvailable()) {
        logger.warn("Cache is disabled");
        observable = this.scheduleValueComputationForDisabledCache(key,supplier,this.herdDict);
    }
    else {
        const metricsRecorder = this.metrics;
        const memcachedClient = this.client;
        const herdDict = this.herdDict;
        var obsy = new Rx.Observable.create(function(observer) {
            logger.debug("set requested for {0}",key);
            metricsRecorder.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_ALL);
            var innersub = _completeFromSupplier(metricsRecorder,memcachedClient,
                                             key,observer,supplier,
                                             ttl,waitForSet,
                                             isSupplierValueCachablePredicate,herdDict);
            return _ => {
                if(innersub) {
                    innersub.unsubscribe();
                }
            }
        });

        observable = obsy.take(1).shareReplay(1);
    }
    this.herdDict[key] = observable;
    return observable;
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
 * @return {Observable} An observable that will return a CacheItem; which will be either 
 *                      a value from the cache or a value generated from the give supplier
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
            observable = this.scheduleValueComputationForDisabledCache(key,supplier,this.herdDict);
        } else {
            const metricsRecorder = this.metrics;
            const memcachedClient = this.client;
            const herdDict = this.herdDict;
            var obsy = new Rx.Observable.create(function(observer) {
                var distributedCacheObs = memcachedClient.get(key);
                var innersub = null;
                const sub = distributedCacheObs.subscribe((cachedItem) => {
                    if(cachedItem.isNotFromCache()) {
                        metricsRecorder.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_ALL);
                        innersub = _completeFromSupplier(metricsRecorder,memcachedClient,
                                             key,observer,supplier,
                                             ttl,waitForSet,
                                             isSupplierValueCachablePredicate,herdDict);
                    }
                    else {
                        if(isCachedValueValidPredicate(cachedItem.value())) {
                            metricsRecorder.logCacheHit(key, CacheMetricStrings.CACHE_TYPE_ALL);
                            observer.next(cachedItem);
                            delete herdDict[key];
                        } else {
                            metricsRecorder.logCacheMiss(key, CacheMetricStrings.CACHE_TYPE_ALL);
                            innersub = _completeFromSupplier(metricsRecorder,memcachedClient,
                                                key,observer,supplier,
                                                ttl,waitForSet,
                                                isSupplierValueCachablePredicate,herdDict);
                        }
                    }
                },null,null);
                return _ => {
                    if(innersub) {
                        innersub.unsubscribe();
                    }
                    sub.unsubscribe();
                }
            });
            observable = obsy.take(1).shareReplay(1);
        }

        this.herdDict[key] = observable;
        this.metrics.logCacheMiss(key,CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION);

        return observable
    }
}


HerdCache.prototype.clear = function(key) {
    return this.client.del(key);
}

HerdCache.prototype.flush = function(cb) {
    this.client.flush(cb);
}

module.exports = HerdCache;
