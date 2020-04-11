var EventEmitter = require('events').EventEmitter;
var util = require('util');

function LogEmitter() {
  EventEmitter.call(this);
}

util.inherits(LogEmitter, EventEmitter);

var logEmitter = new LogEmitter();

module.exports.log = function(level, message, ...args) {
  logEmitter.emit('campbell-cache-log-event', level, message, ...args);
}

module.exports.logEmitter = logEmitter