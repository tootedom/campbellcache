const Logging = require('./testlogging');
var chai = require('chai');
var expect = chai.expect;
const Rx = require('rxjs');
const metrics = require('metrics');
const rp = require('request-promise');
const freeportfinder = require("find-free-port");
const CacheMetricStrings = require('../lib/cachemetricstrings');
const Constants = require('../lib/constants');

var mc = require('memcache-server-stream');

var assert = require('assert');
var proxyquire = require('proxyquire');
var CampbellCache2 = require('../lib/campbellcache');
var fs = require('fs');


describe('CampbellCache-LargeItems', function() {
  var campbellcache;
  var campbellcacheWithLargeItems;
  var supplierCalled;
  var server;
  var mockMemcachedServerPort;


  beforeEach(function() {
    console.log("=============================");
    supplierCalled=0;

    freeportfinder(12000,function(err,freePort) {
      if(err) {
        throw err;
      }

      mockMemcachedServerPort = freePort;
      server = mc.server();

      try {
        server.listen(mockMemcachedServerPort,function(){
          console.log('ready for connections from memcache clients');
        })
      } catch (err) {
        console.log(err);
      }

      campbellcache = new CampbellCache2({
        autodiscovery : false,
        hosts : ["127.0.0.1:"+mockMemcachedServerPort],
        autodiscovery_intervalInMs: 200
      })

      campbellcacheWithLargeItems = new CampbellCache2({
        autodiscovery : false,
        hosts : ["127.0.0.1:"+mockMemcachedServerPort],
        autodiscovery_intervalInMs: 200,
        memcached_opts : {
            maxValue : 1048576*3
        }
      });

    });

  });

  afterEach(function() {
    try {
      campbellcache.shutdown();
    } catch(err) {
      console.log("cache shutdown err:" + err);
    }

    try {
      campbellcacheWithLargeItems.shutdown();
    } catch(err) {
      console.log("cache shutdown err:" + err);
    }


    try {
      server.close(function() {
        console.log("closed");
      });
    } catch (err) {
      console.log("memcached server close err:"+ err);
    }

    console.log("=============================");
  });

  describe("apply", function() {
    it("It can cache a file larger than 1mb if specified to", function(done) {

      cacheEnabled = true;

      var key = "2mbin";
      var payload = fs.readFileSync(__dirname + '/fixtures/2mbfile', 'utf8');
      this.timeout(5000);
      var observableCalled=0;
      var successCalled = 0;
      var errorCalled=0;
      // Run in a set timeout to allow autodiscover to return disabled cache
      setTimeout(() => {
        var supplier = function() {
            return new Promise((resolve,reject) => {
              observableCalled++;
              console.log("Promise Running");
              resolve(payload);
            })
        };

        var obs = campbellcacheWithLargeItems.apply(key,supplier,{ ttl: 60 } ).toPromise();

        obs.then((value) => {
          successCalled++;
          assert.equal(value.isError(),false);
          assert.equal(value.isFromCache(),false);
        }).catch((error) => {
          errorCalled++;
        })

        setTimeout(() => {
          var obs2 = campbellcacheWithLargeItems.apply(key,supplier,{ ttl: 60 } ).toPromise();
          obs2.then((value) => {
            successCalled++;
            assert.equal(value.isError(),false);
            assert.equal(value.isFromCache(),true);
          }).catch((error) => {
            errorCalled++;
          })

        },1000);

        setTimeout(() => {
          assert.equal(observableCalled,1,"promise function should have been called");
          assert.equal(successCalled,2,"success subscriber function should have been called");
          assert.equal(errorCalled,0,"error function not should have been called");
          done();
        },3000);
      },300);
    });

    it("cannot cache a file larger than 1mb by default", function(done) {
      var payload = fs.readFileSync(__dirname + '/fixtures/2mbfile', 'utf8');

      this.timeout(5000);

        var key = "2mbin";

        var observableCalled=0;
        var successCalled = 0;
        var errorCalled=0;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var supplier = function() {
              return new Promise((resolve,reject) => {
                observableCalled++;
                console.log("Promise Running");
                resolve(payload);
              })
          };

          var obs = campbellcache.apply(key,supplier,{ ttl: 60 } ).toPromise();

          obs.then((value) => {
            successCalled++;
            assert.equal(value.isError(),false);
            assert.equal(value.isFromCache(),false);
          }).catch((error) => {
            errorCalled++;
          })

          setTimeout(() => {
            var obs2 = campbellcache.apply(key,supplier,{ ttl: 60 } ).toPromise();
            obs2.then((value) => {
              successCalled++;
              assert.equal(value.isError(),false);
              assert.equal(value.isFromCache(),false);
            }).catch((error) => {
              errorCalled++;
            })

          },1000);

          setTimeout(() => {
            assert.equal(observableCalled,2,"promise function should have been called");
            assert.equal(successCalled,2,"success subscriber function should have been called");
            assert.equal(errorCalled,0,"error function not should have been called");
            done();
          },2000);
        },300);
    });

    it("can cache a 880kb file by default", function(done) {
      var payload = fs.readFileSync(__dirname + '/fixtures/800kbfile', 'utf8');

      this.timeout(5000);

        var key = "800kbin";

        cacheEnabled = true;
        var observableCalled=0;
        var successCalled = 0;
        var errorCalled=0;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var supplier = function() {
              return new Rx.Observable.create((resolve) => {
                observableCalled++;
                console.log("Promise Running");
                resolve.next(payload);
              })
          };

          var obs = campbellcache.apply(key,supplier,{ ttl: 60 } ).toPromise();

          obs.then((value) => {
            successCalled++;
            assert.equal(value.isError(),false);
            assert.equal(value.isFromCache(),false);
          }).catch((error) => {
            errorCalled++;
          })

          setTimeout(() => {
            var obs2 = campbellcache.apply(key,supplier,{ ttl: 60 } ).toPromise();
            obs2.then((value) => {
              successCalled++;
              assert.equal(value.isError(),false);
              assert.equal(value.isFromCache(),true);
            }).catch((error) => {
              errorCalled++;
            })
          },1000);

          setTimeout(() => {
            assert.equal(observableCalled,1,"promise function should have been called");
            assert.equal(successCalled,2,"success subscriber function should have been called");
            assert.equal(errorCalled,0,"error function not should have been called");
            done();
          },3000);
        },300);
    });
  });


});

function monkeyPatchGet(timeout,mock) {
  const originalGet = mock.prototype.get;
  var called = 0;
  const get = function(key,cb) {
    called++;
    setTimeout(() => {
      originalGet.call(this,key,cb);
    },timeout);
  }

  mock.prototype.get = get

  return function() {
    return called;
  }
}

function monkeyPatchSet(timeout,mock) {
  const originalset = mock.prototype.set;
  var called = 0;
  const set = function(key,value,ttl,cb) {
    setTimeout(() => {
      console.log("calling memcached set: "+key + " : " + value + " : ttl: " + ttl);
      called++;
      originalset.call(this,key,value,ttl,cb);
    },timeout);
  }

  mock.prototype.set = set

  return function() {
    return called;
  }
}