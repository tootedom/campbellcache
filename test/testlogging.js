var slf4j = require('binford-slf4j');
var binfordLogger = require('binford-logger');

var configNotInitialised = true;
function Logging() {
    if(configNotInitialised) {
        slf4j.setLoggerFactory(binfordLogger.loggerFactory);
        slf4j.loadConfig({
            level: slf4j.LEVELS.DEBUG,
            appenders:
                [{
                    appender: binfordLogger.getDefaultAppender()
                }]
        });
        configNotInitialised = false;
    }
}

module.exports = Logging;