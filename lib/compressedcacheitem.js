const FLAG_JSON = 1<<1;
const FLAG_BUFFER = 1<<2;
const FLAG_STRING = 1<<3;


function CompressedCacheItem(type,value) {
    this.flag = type;
    this.value = value;
}

CompressedCacheItem.prototype.getValue = function() {
    return this.value;
}

CompressedCacheItem.prototype.getFlag = function() {
    return this.flag;
}

module.exports = CompressedCacheItem;

