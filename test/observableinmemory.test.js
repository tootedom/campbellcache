const Logging = require('./testlogging');
var assert = require('assert');

var proxyquire = require('proxyquire');
const metrics = require('../lib/metricrecorder');
const cached = require('../lib/observable-inmemory')

describe('ObservableInMemory', function() {
  var cache;
  var key = "ccccc";
  var keyValue = "BOB";

  beforeEach(function() {
    cache = new cached(true,["bob"],{
      metricsrecorder: new metrics()
    });
    // Set key to BOB for 10 mins
    cache.set(key,keyValue,900);
  });

  afterEach(function() {
    console.log("Shutting down");
    cache.shutdown();
  });

  describe("Gets", function() {
    it("Returns observable from get request that takes time to fulfil",
      function(done) {
        // add a delay to the test
        this.timeout(5000);
        var obs = cache.get(key);

        var observerCount = 0;
        setTimeout(() => {
          obs.subscribe(function(value) {
            assert.equal(keyValue,value.value());
            observerCount += 1;
          });

          obs.subscribe(function(value) {
            assert.equal(keyValue,value.value());
            observerCount += 1;
          });

          obs.subscribe(function(value) {
            assert.equal("BOB",value.value());
            assert.equal(key,value.getKey());
            assert.equal(key,value.key);
            assert.equal(true,value.isFromCache());
            assert.equal(true,value.hasValue());
            assert.equal(false,value.isEmpty());
            observerCount += 1;
          });

        },500);


        setTimeout(() => {
          console.log("lkjlkjlkj");
          assert.equal(3,observerCount);
          done();
        },2000);
    });

    it("Returns observable from get request, with empty value, that takes time to fulfil",
      function(done) {
        // add a delay to the test
        this.timeout(5000);
        var obs = cache.get("does_not_exist");

        obs.subscribe(function(value) {
          assert.equal(null,value.value());
          assert.equal(keyValue,value.value("BOB"));
          assert.equal("does_not_exist",value.getKey());
          assert.equal("does_not_exist",value.key);
          assert.equal(false,value.isFromCache());
          assert.equal(false,value.hasValue());
          assert.equal(true,value.isEmpty());
          done();
        });
    });


    it("Returns observable from set and get returns value thats been set",
      function(done) {
        // add a delay to the test
        this.timeout(6000);

        var obs_get = cache.get("bobby");
        var obs_get2 = cache.get("bobby");
        var obs_get3 = cache.get("bobby");

        obs_get.subscribe(function(value) {
          assert.equal(null,value.value());
        });

        setTimeout(() => {
          cache.set("bobby","thing",2)
        },1000);

        setTimeout(() => {

          obs_get2.subscribe(function(value) {
            assert.equal("thing",value.value());
          })
        },2000);

        setTimeout(() => {
          obs_get3.subscribe(function(value) {
            assert.equal(null,value.value());
            done();
          })
        },4000);
    });
  });
});

