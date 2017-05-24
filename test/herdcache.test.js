var assert = require('assert');
var proxyquire = require('proxyquire');
var HerdCache = require('../lib/herdcache');
var fs = require('fs');

var AutodiscoveryServer = require('./autodiscovery-server');

describe('ObservableMemcached', function() {
  var memcachedMock;
  var InMemoryObservableMemcached;
  var ObservableMemcached;
  var herdcache;
  var testAutodiscoveryServer;
  const key = "key";
  const value = "BOB";

  beforeEach(function() {
    memcachedMock = require('memcached-mock');
    InMemoryObservableMemcached = proxyquire('../lib/observable-memcached', {memcached: memcachedMock});
    herdcache = new HerdCache({
      autodiscovery : true,
      autodiscovery_url : "127.0.0.1:11211",
      autodiscovery_interval: 200
    })

    testAutodiscoveryServer = new AutodiscoveryServer(fs.readFileSync(__dirname + '/fixtures/single', 'utf8'));
    ObservableMemcached = new InMemoryObservableMemcached(true);
    HerdCache.prototype._observableMemcacheFactory = function(hosts,options) {
      console.log("Calling Factory");
      return ObservableMemcached;
    }

    // Set key to BOB for 10 mins
    ObservableMemcached.client.set(key,value,600,function() {});
  });

  afterEach(function() {
    testAutodiscoveryServer.shutdown();
    herdcache.shutdown();
  });

  describe("Gets", function() {
    it("Returns observable from get request that takes time to fulfil",
      function(done) {
        // add a delay to the test
        monkeyPatchGet(1000,memcachedMock);
        this.timeout(5000);

        //
        // need to wait for autodiscovery to have run first
        // to have created the memcached client with the memcachedMock
        //
        setTimeout(() => {
          var obs = herdcache.get(key);
          obs.subscribe(function(retrievedValue) {
            console.log("value got: "+ retrievedValue);
            assert.equal("BOB",retrievedValue.value());
            done();
          });
        },500)

        // obs.subscribe(function(value) {
        //   assert.equal("BOB",value.value());
        //   observerCount += 1;
        // });

        // obs.subscribe(function(value) {
        //   assert.equal("BOB",value.value());
        //   assert.equal("key",value.getKey());
        //   assert.equal("key",value.key);
        //   assert.equal(true,value.isFromCache());
        //   assert.equal(true,value.hasValue());
        //   assert.equal(false,value.isEmpty());
        //   observerCount += 1;
        // });

        // setTimeout(() => {
        //   assert.equal(3,observerCount);
        //   done();
        // },1500);
    });

  });
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