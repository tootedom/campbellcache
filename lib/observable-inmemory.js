const logger = require('./log');
const CachingMap = require('caching-map');
const Rx = require('rxjs');
const CacheItem = require('./cacheitem');
const NoOpMetricRecorder = require('./noopmetricsrecorder');
const Timer = require('./timer');
const CacheMetricStrings = require('./cachemetricstrings');



function ObservableInMemory(enabled, hosts, opts) {
    this.enabled = true;
    this.metricsRecorder = opts.metricsrecorder || new NoOpMetricRecorder();
    this.cache = new CachingMap();

    this.stopClient = function() {
        try {
            oldcache = this.cache;
            this.cache = new CachingMap();
            oldcache.clear()
            logger.log('debug',"Shutdown old client");
        } catch(err) {
            logger.log('warn',"Exception encounter attempting to close memcached client %s",err);
        }
    }

    return this;
}

ObservableInMemory.prototype.isAvailable = function() {
    return this.enabled;
}

ObservableInMemory.prototype.set = function(key,value,ttl,observable) {
    if(this.enabled) {
        logger.log('debug','Cache Enabled');
        this.cache.set(key,value,{ttl : ttl*1000} )
        if(observable) {
            observable.next(new CacheItem(key,value,false));
        }
    } else {
        if(observable) {
            observable.next(new CacheItem(key,value,false));
        }
    }
}


ObservableInMemory.prototype.del = function(key) {
    if(this.enabled) {
        var obsy = new Rx.Observable.create(function(observer) {
            removed = this.cache.delete(key)
            observer.next(true);
            observer.complete();
        });

        return obsy.take(1).shareReplay(1);
    } else {
        return new Rx.Observable.of(false);
    }
}

ObservableInMemory.prototype.get = function(key) {
    var client = this.client;
    if(this.enabled) {
        logger.log('debug',"Cache is enabled");
        const timer = new Timer();
        const metricRecorder = this.metricsRecorder;
        var obsy = new Rx.Observable.create((observer) => {
            item = this.cache.get(key)
            if (item && typeof item != 'undefined') {
                metricRecorder.logCacheHit(key,CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE);
                observer.next(new CacheItem(key,item,true));
            } else {
                metricRecorder.logCacheMiss(key,CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE);
                observer.next(new CacheItem(key,null,false));
            }
            metricRecorder.incrementCounter(CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE);
            metricRecorder.setDuration(CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE,timer.inspect());
            observer.complete();
        });
        return obsy.take(1).shareReplay(1);
    } else {
        logger.log('warn',"Cache is disabled");
        this.metricsRecorder.logCacheMiss(key,CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE);
        return new Rx.Observable.of(new CacheItem(key,null,false)).take(1);
    }
}

/**
 * This will remove everything in your cache.. Are you sure you want to do this?
 */
ObservableInMemory.prototype.flush = function(cb) {
    var callback = (err, res) => {};
    if(cb) {
        callback = cb;
    }
    if (this.enabled) {
        this.cache.clear();
        callback();
    } else {
        callback();
    }
}

ObservableInMemory.prototype.shutdown = function(gracePeriodTTL) {
    var grace_ttl = gracePeriodTTL;
    if(arguments.length == 0 || (typeof gracePeriodTTL == 'undefined')) {
        grace_ttl = 1000;
    }
    if(grace_ttl>0) {
        setTimeout(() => {
            this.stopClient();
        },gracePeriodTTL);
    } else {
        this.stopClient();
    }
    this.enabled = false;
}


ObservableInMemory.prototype.setMetricsRecorder = function(metricsRecorder) {
    this.metricsRecorder = metricsRecorder;
}

module.exports = ObservableInMemory;


