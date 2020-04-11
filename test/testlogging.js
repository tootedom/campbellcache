const winston = require('winston');
const CampbellCache = require('../lib/campbellcache');

const logger = winston.createLogger({
    level: 'debug'

});
logger.add(new winston.transports.Console({
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.simple()
    ),
}));

var initialized = false;
module.exports.initialize = function() {
    if (!initialized) {
        initialized = true;
        CampbellCache.logEmitter.on('campbell-cache-log-event', function(level, message, ...args) {
            logger.log(level, message, ...args)
        });
    }
}