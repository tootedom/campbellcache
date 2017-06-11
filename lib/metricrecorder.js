const metrics = require('metrics')
const logger = require('binford-slf4j').getLogger('cache-requests-logger.js');


/**
 * A generic MetricRecorder instance.
 * @param {string} opts.prefix : prefix for the all the metric names above
 * @param {metrics.Server} opts.server : The metrics server into which to register metrics
 * @constructor
 */
function MetricRecorder(opts) {
    opts = opts || {};
    this._metricCounters = {};
    this._metricMeters = {};
    this._metricTimers = {};
    this.prefix = opts.prefix || null;
    this.registries = opts.registries || null;
    this.hasPrefix = false;
    this.hasRegistry = false;

    if(this.prefix!=null && this.prefix.trim().length!=0) {
        this.hasPrefix = true;
    }

    if(this.registries != null) {
        if (!Array.isArray(this.registries)) {
            this.registries = [this.registries];
        }
        this.hasRegistry = true;
    }

    this._getMetricName = function(metricName) {
        if(this.hasPrefix) {
            return this.prefix + metricName;
        } else {
            return metricName;
        }
    }


    /**
     * Get the Timer object that tracks the milliseconds (duration) of a metric with a given name
     *
     *
     * @param {string} metricName
     * @return {metrics.Timer}
     */
    this._getMetricTimer = function (metricName) {
        if (!this._metricTimers[metricName]) {
            var timer = new metrics.Timer();
            this._metricTimers[metricName] = timer;
            if(this.hasRegistry) {
                this.registries.forEach(function(registry) {
                    registry.addMetric(metricName,timer);
                });
            }
        }
        return this._metricTimers[metricName]
    }

    /**
     * Get the Counter object that tracks the number times a metric with a given name
     * has been called.
     *
     * @param {string} metricName
     * @return {metrics.Counter}
     */
    this._getMetricCounter = function (metricName) {
        if (!this._metricCounters[metricName]) {
            var counter = new metrics.Counter();
            this._metricCounters[metricName] = counter;
            if(this.hasRegistry) {
                this.registries.forEach(function(registry) {
                    registry.addMetric(metricName,counter);
                });
            }
        }
        return this._metricCounters[metricName]
    }


    /**
     * Get the Meter object that tracks the number times a metric with a given name
     * has been called.
     *
     * @param {string} metricName
     * @return {metrics.Meter}
     */
    this._getMetricMeter = function (metricName) {
        if (!this._metricMeters[metricName]) {
            var meter = new metrics.Meter();
            this._metricMeters[metricName] = meter;
            if(this.hasRegistry) {
                this.registries.forEach(function(registry) {
                    registry.addMetric(metricName,meter);
                });
            }
        }
        return this._metricMeters[metricName]
    }

    /**
     * increments a counter that records the number of times a metric with given
     * method name has been called
     *
     * @param {string} The name of the metric
     * @return {int} the current count for the metric (after inc has been done)
     */
    this._incMetricCounter = function (metricName) {
        var counter = this._getMetricCounter(metricName);
        counter.inc();
        return counter.count;
    }

    /**
     * increments a meter that records the number of times a metric with given
     * method name has been called
     *
     * @param {string} The name of the metric
     */
    this._incMetricMeter = function (metricName) {
        var counter = this._getMetricMeter(metricName);
        counter.mark();
    }

    /**
     * resets a the metric with the given name
     *
     * @param {string} the name of the metric
     */
    this._clearMetricCounter = function (metricName) {
        var counter = this._getMetricCounter(metricName);
        counter.clear();
    }
}

MetricRecorder.prototype.cacheMiss = function (metricName)  {
    metricName = this._getMetricName(metricName);
    this._incMetricCounter(metricName+"_misscount");
    this._incMetricMeter(metricName+"_missrate");
}

MetricRecorder.prototype.cacheHit = function (metricName)  {
    metricName = this._getMetricName(metricName);
    this._incMetricCounter(metricName+"_hitcount");
    this._incMetricMeter(metricName+"_hitrate");
}

MetricRecorder.prototype.logCacheHit = function (key, cacheType){
    logger.debug("{ \"cachehit\" : \"{0}\", \"cachetype\" : \"{1}\"}",key,cacheType);
    this.cacheHit(cacheType);
}

MetricRecorder.prototype.logCacheMiss = function (key, cacheType){
    logger.debug("{ \"cachemiss\" : \"{0}\", \"cachetype\" : \"{1}\"}",key,cacheType);
    this.cacheMiss(cacheType);
}

MetricRecorder.prototype.incrementCounter = function(metricName) {
    metricName = this._getMetricName(metricName);
    this._incMetricCounter(metricName+"_count");
}

MetricRecorder.prototype.setDuration = function(metricName,duration) {
    metricName = this._getMetricName(metricName);
    this._getMetricTimer(metricName+"_timer").update(duration);
}


module.exports = MetricRecorder;