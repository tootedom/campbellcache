var assert = require('assert');

var proxyquire = require('proxyquire');
var memcachedMock = require('memcached-mock');

describe('ObservableMemcached', function() {
// module.exports.testSomething = function(done) {
  var cached = proxyquire('../lib/observable-memcached', {memcached: memcachedMock});
  // var mockmemcached = new memcachedMock('127.0.0.1:11211');
  // cached.client.set("key","ljlkj",1000,function(err) {
  //   if (!err) {
  //     mockmemcached.get("key", function(err, data) {
  //       console.log(data); // prints: world!
  //     });
  //   }
// });

  var cache = new cached(true);
  console.log(cache);
  cache.client.set("key","kkkkkk",1000,function() {});
  cache.client.get("key", function(err, data) {
        console.log(data); // prints: world!
  });

  const originalGet = memcachedMock.prototype.get;
  const get = function(key,cb) {
    setTimeout(() => {
      originalGet.call(this,key,cb);
    },1000);
  }
  memcachedMock.prototype.get = get

  describe("Gets", function() {
    it("Should return an observable from get request",function(done) {
      var obs = cache.get("key");

      obs.subscribe(function(value) {
        console.log(value);
        done();
      });
    })
  })
  // };
});