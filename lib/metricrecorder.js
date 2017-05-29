var metrics = require('metrics')


/**
 * A generic MetricRecorder instance.
 *
 * @constructor
 */
function MetricRecorder() {
  this._missCounter = {}
  this._hitCounter = {}
  this._methodCounters = {}
}

/**
 * Get the Counter object that tracks the number times a method with a given name
 * has been called.
 *
 * @param {string} methodName The name of the operation, e.g., get, set, etc.
 * @return {metrics.Counter}
 */
MetricRecorder.prototype._getMethodCounter = function (methodName) {
  if (!this._methodCounters[methodName]) {
      this._methodCounters[methodName] = new metrics.Counter()
  }
  return this._methodCounters[methodName]
}

/**
 * increments a counter that records the number of items a method with given
 * method name has been called
 *
 * @param {string} methodName The name of the operation, e.g., get, apply, etc.
 * @return {int} number of times the method, with methodName has been called
 */
MetricRecorder.prototype.incMethodCounter = function (methodName) {
  var counter = this._getMethodCounter(methodName);
  counter.inc();
  return counter.count;
}

/**
 * resets a counter that records the number of items a method with given
 * method name has been called
 *
 * @param {string} methodName The name of the operation, e.g., get, apply, etc.
 */
MetricRecorder.prototype.clearMethodCounter = function (methodName) {
  var counter = this._getMethodCounter(methodName);
  counter.clear();
}

module.exports = MetricRecorder;