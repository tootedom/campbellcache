const Logging = require('./testlogging');
const chai = require('chai');
const expect = chai.expect;
const assert = require('assert');
const fs = require('fs');
const CampbellCache = require('../lib/campbellcache');
const CompresedCacheItem = require('../lib/compressedcacheitem');
const Rx = require('rxjs');
const snappy = require('snappy')

const FLAG_JSON = 1<<1
            , FLAG_BINARY = 1<<2
            , FLAG_NUMERIC = 1<<3;

describe('MetricRecorder', function() {

    var ns = "org.greencheeck.campbellcache";

    function getMetricValue(metrics,name) {
        return metrics[ns][name]['count'];
    }

    function escapeValue(value) {
        return value.replace(/(\r|\n)/g, '\\$1');
    };

    function convert(value) {
        var valuetype = typeof value;

        var flag;
        if (Buffer.isBuffer(value)) {
            flag = FLAG_BINARY;
            value = value.toString('binary');
        } else if (valuetype === 'number') {
            flag = FLAG_NUMERIC;
            value = value.toString();
        } else if (valuetype !== 'string') {
            flag = FLAG_JSON;
            value = JSON.stringify(value);
        }

        value = escapeValue(value);

        length = Buffer.byteLength(value);
        console.log("FLAG: " + flag);
        console.log("Value Length: " + length);
        return value;
    }

    function fromBuffer(flag,value) {
        var dataSet;
        switch (flag) {
            case FLAG_JSON:
                dataSet = JSON.parse(value);
                break;
            case FLAG_NUMERIC:
                dataSet = +value;
                break;
            case FLAG_BINARY:
                tmp = new Buffer(value.length);
                tmp.write(value, 0, 'binary');
                dataSet = tmp;
                break;
        }
        return dataSet;
    }

    function toBuffer(value) {
        if(Buffer.isBuffer(value)) {
            return buffer
        }
        else {
            var valuetype = typeof value;
            // if(valuetype === 'number') {
            //     return new Buffer(value.toString());
            // } else 
            if (valuetype !== 'string') {
                if (typeof value !== 'undefined' && typeof value.toJSON === 'function') { 
                    new Buffer(value.toJSON());
                } else {
                    return new Buffer(JSON.stringify(value));
                }
            } else {
                return new Buffer(value);
            }
        }
    }

    beforeEach(function() {
    });

    afterEach(function() {
    });

    describe("cacheMiss", function() {
        it("Records cache misses to counter and meter",
        function(done) {

            campbellcache = new CampbellCache({
                autodiscovery : false,
                hosts : ["127.0.0.1:11211"],
                autodiscovery_intervalInMs: 200
            })
            var payload = fs.readFileSync(__dirname + '/fixtures/image.png');
            var payload2 = fs.readFileSync(__dirname + '/fixtures/santapictures.pdf');

            var s = "yo yoyoyoyoyoyoyoy yo!";
            console.log(Buffer.isBuffer(payload));
            console.log(typeof payload.toString());
            console.log(Buffer.isBuffer(s));

            var yy = 'undefined';
            var xx = { 'xxx' :  yy };
            console.log(toBuffer(true));
            console.log(toBuffer(xx));

            var buf = new Buffer.from(JSON.stringify(xx));

            var temp = JSON.parse(buf.toString());
            console.log("------");
            console.log(temp);

            var citem;
            citem = new CompresedCacheItem(CompresedCacheItem.FLAG_BINARY,"string");
            // citem = "1";
            console.log(typeof citem !== 'undefined' && citem.constructor === CompresedCacheItem);

            console.log(fromBuffer(FLAG_JSON,toBuffer(xx).toString()));
            console.log(fromBuffer(FLAG_JSON,toBuffer(10000000).toString()));

            // var buf = new Buffer(payload.toJSON() || JSON.stringify(payload))
            // var buf2 = new Buffer(payload.toJSON() || JSON.stringify(payload))
            // console.log(Buffer.isBuffer(buf))
            // console.log(Buffer.isBuffer(buf2))
            // console.log(buf);

            console.log("dom".toJSON || JSON.stringify("dom"));

            console.log(convert("dom"));
            fs.writeFileSync(__dirname + '/domtest.png',convert(payload));

            snappy.compress(payload2,function(err, compressed) {
                if(err) {
                    console.log("whooa, error in snappy");
                    done();
                }
                else {
                    console.log(compressed);
                    var promise = campbellcache.set("kkkkk",function() {return Rx.Observable.of(compressed)}).toPromise();

                    promise.then((cacheItem) => {
                        fs.writeFileSync(__dirname + '/fixtures/santapictures.pdf.snappy',cacheItem.value());

                        snappy.uncompress(cacheItem.value(),function(err, uncompressed) {
                            if(err) {
                                console.log(err);
                                done();
                            } else {
                                fs.writeFileSync(__dirname + '/fixtures/santapictures.after.pdf',uncompressed);
                                done();
                            }
                        })
                        
                    }).catch((error) => {
                        console.log(error);
                    });
                }
            });

            
        });
    });

});


