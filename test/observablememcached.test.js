var assert = require('assert');

var proxyquire = require('proxyquire');
//var memcachedMock = require('memcached-mock');

describe('ObservableMemcached', function() {
  var memcachedMock;
  var cached;
  var cache;

  beforeEach(function() {
    memcachedMock = require('memcached-mock');
    cached = proxyquire('../lib/observable-memcached', {memcached: memcachedMock});
    cache = new cached(true);
    // Set key to BOB for 10 mins
    cache.client.set("key","BOB",600,function() {});
  });

  afterEach(function() {
    console.log("Shutting down");
    cache.shutdown();
  });

  describe("Gets", function() {
    it("Returns observable from get request that takes time to fulfil",
      function(done) {
        // add a delay to the test
        monkeyPatchGet(1000,memcachedMock);
        this.timeout(5000);
        var obs = cache.get("key");
        var observerCount = 0;
        setTimeout(() => {
          obs.subscribe(function(value) {
            assert.equal("BOB",value);
            observerCount += 1;
          });
        },500);

        obs.subscribe(function(value) {
          assert.equal("BOB",value);
          observerCount += 1;
        });

        obs.subscribe(function(value) {
          assert.equal("BOB",value);
          observerCount += 1;
        });

        setTimeout(() => {
          assert.equal(3,observerCount);
          done();
        },1500);
      });
  })
});

function monkeyPatchGet(timeout,mock) {
  const originalGet = mock.prototype.get;
  const get = function(key,cb) {
    setTimeout(() => {
      originalGet.call(this,key,cb);
    },1000);
  }
  mock.prototype.get = get
}