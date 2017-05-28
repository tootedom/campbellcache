var slf4j = require('binford-slf4j');
var binfordLogger = require('binford-logger');

slf4j.setLoggerFactory(binfordLogger.loggerFactory);
slf4j.loadConfig({
    level: slf4j.LEVELS.DEBUG,
    appenders:
	    [{
		    appender: binfordLogger.getDefaultAppender()
	    }]
});

var assert = require('assert');

var proxyquire = require('proxyquire');

describe('ObservableMemcached', function() {
  var memcachedMock;
  var originalGet;
  var cached;
  var cache;
  var key = "xxxx";
  var keyValue = "BOB";

  beforeEach(function() {
    memcachedMock = require('memcached-mock');
    cached = proxyquire('../lib/observable-memcached', {memcached: memcachedMock});
    cache = new cached(true,["bob"]);
    // Set key to BOB for 10 mins
    cache.client.set(key,keyValue,600,function() {});
    originalGet = memcachedMock.prototype.get;
  });

  afterEach(function() {
    console.log("Shutting down");
    cache.shutdown();
    memcachedMock.prototype.get = originalGet;
  });

  describe("Gets", function() {
    it("Returns observable from get request that takes time to fulfil",
      function(done) {
        // add a delay to the test
        monkeyPatchGet(1000,memcachedMock);
        this.timeout(5000);
        var obs = cache.get(key);

        var observerCount = 0;
        setTimeout(() => {
          obs.subscribe(function(value) {
            assert.equal(keyValue,value.value());
            observerCount += 1;
          });
        },500);

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

        setTimeout(() => {
          assert.equal(3,observerCount);
          done();
        },1500);
    });

    it("Returns observable from get request, with empty value, that takes time to fulfil",
      function(done) {
        // add a delay to the test
        monkeyPatchGet(1000,memcachedMock);
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
  });
});

function monkeyPatchGet(timeout,mock) {
  const originalGet = mock.prototype.get;
  const get = function(key,cb) {
    setTimeout(() => {
      originalGet.call(this,key,cb);
    },timeout);
  }
  mock.prototype.get = get
}