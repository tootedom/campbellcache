
function NoOpMetricRecorder() {}

NoOpMetricRecorder.prototype.cacheMiss = function (metricName)  {
}

NoOpMetricRecorder.prototype.cacheHit = function (metricName)  {
}

NoOpMetricRecorder.prototype.logCacheHit = function (key, cacheType){
}

NoOpMetricRecorder.prototype.logCacheMiss = function (key, cacheType){
}

NoOpMetricRecorder.prototype.incrementCounter = function(metricName) {
}

NoOpMetricRecorder.prototype.setDuration = function(metricName,duration) {
}

module.exports = NoOpMetricRecorder;