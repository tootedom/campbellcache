const snappy = require('snappy');
const CompresedCacheItem = require('./compressedcacheitem');

const FLAG_JSON = 1<<1;
const FLAG_BUFFER = 1<<2;
const FLAG_STRING = 1<<3;


function Compressor() {

}

Compressor.prototype.compress = function(value,callback) {
    return this.value;
}

Compressor.prototype.decompress = function(value, callback) {
    if(typeof value !== 'undefined' && value.constructor === CompresedCacheItem) {

    } else {
        callback()
    }
    return this.flag;
}

module.exports = Compressor;

