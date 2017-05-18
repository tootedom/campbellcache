const Optional = require('optional-js');


function CacheItem(key,value,fromCache) {
    this.key = key;
    this.valueOptional = Optional.ofNullable(value);
    this.fromCache = fromCache;
}

CacheItem.prototype.optional = function() {
    return this.valueOptional;
}

CacheItem.prototype.value = function() {
    if(this.valueOptional.isPresent()) {
        return this.valueOptional.get();
    } else {
        return null;
    }
}

CacheItem.prototype.value = function(defaultValue) {
    return this.valueOptional.isPresent() ? this.valueOptional.get() : defaultValue;
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

