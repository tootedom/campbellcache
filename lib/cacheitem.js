const Optional = require('optional-js');


function CacheItem(key,value,fromCache,error) {
    this.key = key;
    this.valueOptional = Optional.ofNullable(value);
    this.fromCache = fromCache;
    if(arguments.length >= 4) {
        this.error = error;
        if(error) {
            this.fromCache = false;
        }
    } else {
        this.error = false;
    }
}

CacheItem.prototype.optional = function() {
    return this.valueOptional;
}

CacheItem.prototype.value = function(defaultValue) {
    var val = null;
    if (arguments.length !== 0) {
        val = defaultValue;
    }

    if(this.valueOptional.isPresent()) {
        return this.valueOptional.get();
    } else {
        return val;
    }
}

CacheItem.prototype.isError = function() {
    return this.error;
}

CacheItem.prototype.getValue = function() {
    return this.valueOptional;
}

CacheItem.prototype.getKey = function() {
    return this.key;
}

CacheItem.prototype.isFromCache = function() {
    return this.fromCache;
}

CacheItem.prototype.isNotFromCache = function() {
    return !this.fromCache;
}

CacheItem.prototype.toString = function() {
    return this.valueOptional.toString();
}

CacheItem.prototype.isEmpty = function() {
    return !this.valueOptional.isPresent();
}

CacheItem.prototype.hasValue = function() {
    return this.valueOptional.isPresent();
}


module.exports = CacheItem;

