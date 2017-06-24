const Logging = require('./testlogging');
var chai = require('chai');
var expect = chai.expect;
const Rx = require('rxjs');
const metrics = require('metrics');
const rp = require('request-promise');
const freeportfinder = require("find-free-port");
const CacheMetricStrings = require('../lib/cachemetricstrings');

var jswiremocklib, jswiremock, stubFor, get, post, urlEqualTo, a_response;
jswiremocklib = require('jswiremock'), jswiremock = jswiremocklib.jswiremock, stubFor = jswiremocklib.stubFor, get = jswiremocklib.get, post = jswiremocklib.post, urlEqualTo = jswiremocklib.urlEqualTo, a_response = jswiremocklib.a_response, stopJSWireMock = jswiremocklib.stopJSWireMock;


var assert = require('assert');
var proxyquire = require('proxyquire');
var HerdCache = require('../lib/herdcache');
var fs = require('fs');

var AutodiscoveryServer = require('./autodiscovery-server');


describe('HerdCache', function() {
  var memcachedMock;
  var memcachedMockOriginalGet;
  var memcachedMockOriginalSet;
  var InMemoryObservableMemcached;
  var EnabledObservableMemcached;
  var DisabledObservableMemcached;
  var herdcache;
  var testAutodiscoveryServer;
  const key = "key";
  const key2 = "sunday";
  const value = "BOB";
  var cacheEnabled = true;
  var wiremock = null;
  var mockPort;
  var supplierCalled;
  var restBody = "[{\"status\":\"success\"}]";
  var restBody2 = "[{\"status\":\"failed\"}]";
  var slowHttpRequest1Second;
  var slowHttpRequest1Second2;
  var reporter;

  function getMetricValue(metrics,name) {
        return metrics["org.greencheek"][name]['count'];
  }


  beforeEach(function() {
    console.log("=============================");
    supplierCalled=0;
    // find a port to run the wiremock on
    freeportfinder(3000, function(err, freePort){
      if(err) {
        throw err;
      }
      wiremock = new jswiremock(freePort); //port
      mockPort=freePort;
      stubFor(wiremock, get(urlEqualTo("/bob"))
        .willReturn(a_response()
            .withStatus(200)
            .withHeader({"Content-Type": "application/json"})
            .withBody(restBody)));

      stubFor(wiremock, get(urlEqualTo("/bob2"))
        .willReturn(a_response()
            .withStatus(200)
            .withHeader({"Content-Type": "application/json"})
            .withBody(restBody2)));
    });

    reporter = new metrics.Report;
    memcachedMock = require('memcached-mock');
    InMemoryObservableMemcached = proxyquire('../lib/observable-memcached', {memcached: memcachedMock});
    herdcache = new HerdCache({
      autodiscovery : true,
      autodiscovery_url : "127.0.0.1:11211",
      autodiscovery_intervalInMs: 200,
      metrics_registries : reporter,
      metrics_prefix : "org.greencheek."
    })

    testAutodiscoveryServer = new AutodiscoveryServer(fs.readFileSync(__dirname + '/fixtures/single', 'utf8'));
    EnabledObservableMemcached = new InMemoryObservableMemcached(true,["blah"]);
    DisabledObservableMemcached = new InMemoryObservableMemcached(false,["blah"]);
    HerdCache.prototype._observableMemcacheFactory = function(hosts,options) {
      if(cacheEnabled) {
        console.log("returning enabled cache");
        if(options.metricsrecorder) {
          EnabledObservableMemcached.setMetricsRecorder(options.metricsrecorder);
        }
        return EnabledObservableMemcached;
      } else {
        console.log("returning disabled cache");
        if(options.metricsrecorder) {
          DisabledObservableMemcached.setMetricsRecorder(options.metricsrecorder);
        }
        return DisabledObservableMemcached;
      }
    }

    // Set key to BOB for 10 mins
    // EnabledObservableMemcached.client.set(key,value,600,function() {});
    memcachedMockOriginalGet = memcachedMock.prototype.get;
    memcachedMockOriginalSet = memcachedMock.prototype.set;
    // only execute the request after 1 second.
    slowHttpRequest1Second = Rx.Observable.create(function(observer) {
      setTimeout(() => {
        var rep = rp('http://127.0.0.1:'+mockPort+'/bob');
          rep.then(function (htmlString) {
            supplierCalled++;
            observer.next(htmlString);
          })
          rep.catch(function (err) {
            supplierCalled++;
            observer.error(err);
          });
        }
      ,1000);
    });

        // only execute the request after 1 second.
    slowHttpRequest1Second2 = Rx.Observable.create(function(observer) {
      setTimeout(() => {
        var rep = rp('http://127.0.0.1:'+mockPort+'/bob2');
          rep.then(function (htmlString) {
            supplierCalled++;
            observer.next(htmlString);
          })
          rep.catch(function (err) {
            supplierCalled++;
            observer.error(err);
          });
        },1000);
    });
  });

  afterEach(function() {
    wiremock.stopJSWireMock();
    testAutodiscoveryServer.shutdown();
    herdcache.flush();
    herdcache.shutdown();
    if(memcachedMock) {
      // console.log("memcached mocke cache : " + memcachedMock._cache);
      // memcachedMock._cache = {};
      memcachedMock.prototype.get = memcachedMockOriginalGet;
      memcachedMock.prototype.set = memcachedMockOriginalSet;
    }
    console.log("=============================");
  });

  describe("apply", function() {
    it("bob", function(done) {
      var i =0;
      this.timeout(4000);
      var obys = new Rx.Observable.of(1);
      // obys.subscribe((value) => console.log(value),null,null);

      var obs = new Rx.Observable.create(function(observer) {
        i++;
        console.log("setting next to:" + i);
        console.log("doing sub on obsy");
        var sub = obys.subscribe((value) => {
          console.log("val:" + value);
        },null,null);
        observer.next(i);

        return _ => {
          console.log("end, unsub")
          sub.unsubscribe();
        }
      }).take(1).shareReplay(1);

      // console.log("doing sub on obs");
      var s = obs.subscribe((value) => { 
        console.log("given value:" + value);
      },null,() => {
        console.log("complete");
      })

      var oblong = new Rx.Observable.create(function(observer) {
        setTimeout(()=> {
          console.log("running oblong");
          observer.next("bobob");
        }
        );
      }).take(1).shareReplay(1);

      var sublong1 = oblong.subscribe((val) => {
        console.log("sublong1: " + val);
      });

      var sublong2 = oblong.subscribe((val) => {
        console.log("sublong1: " + val);
      });


      var obsOf = new Rx.Observable.of(false);
      setTimeout(() => {
        var s = obs.subscribe((value) => {
          console.log("given value:" + value);
        },null,() => {
          console.log("complete");
        })

        obsOf.subscribe( (value) => {
          console.log("observable.of " + value);
        });

        s.unsubscribe();
        done();
      },2000);

      obsOf.subscribe( (value) => {
        console.log("observable.of " + value);
      });

    });

    //
    // Testing if a slow rest request results in a internal cache hit on the herdcache
    // Observable cache.
    //
    it("Returns observable that results in a value from supplier, when cache is disabled",
      function(done) {
        this.timeout(5000);

        cacheEnabled = false;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var obs = herdcache.apply(key,slowHttpRequest1Second);
          var obs2 = herdcache.apply(key,slowHttpRequest1Second);

          assert.equal(obs,obs2,
                      "the second call to apply should return the currently executing suppler");

          var observableCalled=0;
          obs.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          obs2.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          // Checks that internal cache is cleared on completion
          setTimeout(() => {
              var obs3 = herdcache.apply(key,slowHttpRequest1Second);
              obs3.subscribe(function(retrievedValue) {
                assert.equal(restBody,retrievedValue.value());
                observableCalled++;
              });
          },2000);

          setTimeout(() => {
            assert.equal(observableCalled,3,"all 3 observables should have been called");
            assert.equal(supplierCalled,2,"Supplier function should have been called twice");
            done();
          },3500);
        },300);
    });

    //
    // Testing that a slow rest request results in a internal cache hit on the herdcache
    // Observable cache, when performing a get on the cache.
    //
    it("Returns oobservable to get request, that has been inserted by a previous apply",
      function(done) {
        this.timeout(5000);

        cacheEnabled = false;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var obs = herdcache.apply(key,slowHttpRequest1Second);
          var obs2 = herdcache.get(key);

          assert.equal(obs,obs2,
                      "the second call to apply should return the"+ 
                      "currently executing suppler");

          var observableCalled=0;
          obs.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          obs2.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          //
          // Checks that internal cache is cleared on completion
          //
          setTimeout(() => {
              var obs3 = herdcache.get(key);
              obs3.subscribe(function(retVal) {
                assert.equal(false,retVal.isFromCache());
                assert.equal(null,retVal.value());
                observableCalled++;
              });

              var obs4 = herdcache.apply(key,slowHttpRequest1Second);
              obs4.subscribe(function(retrievedValue) {
                assert.equal(false,retrievedValue.isFromCache());
                assert.equal(restBody,retrievedValue.value());
                observableCalled++;
              });
          },2000);

          setTimeout(() => {
            assert.equal(observableCalled,4,"all 4 observables should have been called");
            assert.equal(supplierCalled,2,"Supplier function should have been called twice");
            done();
          },3500);
        },300);
    });

    //
    // Test that set is adds to internal observable cache that apply reads from
    //
    it("Test that set adds to same internal observable cache as apply",
      function(done) {
        this.timeout(6000);
        cacheEnabled = true;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var obsset1 = herdcache.set("item6",slowHttpRequest1Second);
          var observableCalled=0;

          setTimeout(() => {
            var obsapply1 = herdcache.apply("item6",slowHttpRequest1Second);
            obsapply1.subscribe(function(retrievedValue) {
              assert.equal(obsapply1,obsset1);
              assert.equal(restBody,retrievedValue.value());
              observableCalled++;
            });
          },500);


          obsset1.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          //
          // Checks that the item is not cached
          //
          setTimeout(() => {
              var obsset2 = herdcache.apply("item6",slowHttpRequest1Second2);
              obsset2.subscribe(function(retrievedValue) {
                assert(retrievedValue.isFromCache());
                assert.equal(restBody,retrievedValue.value());
                observableCalled++;
              });
          },2000);

          setTimeout(() => {
            assert.equal(observableCalled,3,"all observables should have been called");
            assert.equal(supplierCalled,1,"Supplier function should have been called twice");
            done();
          },4000);
        },500);
    });

    //
    // Test that set is able to accept a predicate for not caching the supplier value.
    //
    it("Test that set takes a predicate for not caching the supplier value",
      function(done) {
        this.timeout(6000);
        cacheEnabled = true;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var obsset1 = herdcache.set("item6",slowHttpRequest1Second,
                                      {isSupplierValueCachablePredicate:(v)=>{return false;}});

          var observableCalled=0;

          obsset1.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          //
          // Checks that the item is not cached
          //
          setTimeout(() => {
              var obsset2 = herdcache.set("item6",slowHttpRequest1Second2);
              obsset2.subscribe(function(retrievedValue) {
                assert.equal(restBody2,retrievedValue.value());
                observableCalled++;
              });
          },1500);

          setTimeout(() => {
            assert.equal(observableCalled,2,"all observables should have been called");
            assert.equal(supplierCalled,2,"Supplier function should have been called twice");
            done();
          },3000);
        },500);
    });

    //
    // Testing that TTL setting is passed to memcached item.
    //
    it("Test that apply and set, allow the use of TTL setting on items written to the cache",
      function(done) {
        this.timeout(6000);
        cacheEnabled = true;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var obs = herdcache.apply("item1",slowHttpRequest1Second,{ttl:1});
          var obsset1 = herdcache.set("item2",slowHttpRequest1Second,{ttl:1});

          var observableCalled=0;
          obs.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          obsset1.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          //
          // Checks that internal cache is cleared on completion.
          // Item will be expired from cache after 1 second due to ttl
          //
          setTimeout(() => {
              var obs3 = herdcache.apply("item1",slowHttpRequest1Second2);
              obs3.subscribe(function(retrievedValue) {
                assert.equal(restBody2,retrievedValue.value());
                observableCalled++;
              });

              var obsset2 = herdcache.set("item2",slowHttpRequest1Second2);
              obsset2.subscribe(function(retrievedValue) {
                assert.equal(restBody2,retrievedValue.value());
                observableCalled++;
              });

          },2500);

          setTimeout(() => {
            assert.equal(observableCalled,4,"all three observables should have been called");
            assert.equal(supplierCalled,4,"Supplier function should have been called twice");
            done();
          },4500);
        },500);
    });

    //
    // Testing if a slow rest request results in a internal cache hit on the herdcache
    // Observable cache.  When cache is enabled.
    //
    it("Returns observable that results in a value from supplier, when cache is enabled",
      function(done) {
        this.timeout(6000);
        cacheEnabled = true;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var called = monkeyPatchSet(100,memcachedMock);
          var obs = herdcache.apply(key,slowHttpRequest1Second,{ttl:1});
          var obs2 = herdcache.apply(key,slowHttpRequest1Second,{ttl:1});

          assert.equal(obs,obs2,"the second call to apply should return the currently executing suppler");

          var observableCalled=0;
          obs.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          obs2.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          //
          // Checks that internal cache is cleared on completion.
          // Item will be expired from cache after 1 second due to ttl
          //
          setTimeout(() => {
              var obs3 = herdcache.apply(key,slowHttpRequest1Second);
              obs3.subscribe(function(retrievedValue) {
                assert.equal(restBody,retrievedValue.value());
                observableCalled++;
              });
          },3000);

          setTimeout(() => {
            assert.equal(observableCalled,3,"all three observables should have been called");
            assert.equal(supplierCalled,2,"Supplier function should have been called twice");
            done();
          },4500);
        },500);
    });

    // Test that apply writes to the cache.
    it("Check that value from cache is retrieved, after it is set",
      function(done) {
        this.timeout(5000);
        cacheEnabled = true;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var called = monkeyPatchSet(100,memcachedMock);
          var obs = herdcache.apply(key,slowHttpRequest1Second)

          var observableCalled=0;
          obs.subscribe((retrievedValue) => {
            assert(!retrievedValue.isFromCache())
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          setTimeout(() => {
            var obs2 = herdcache.apply(key,slowHttpRequest1Second2)
            obs2.subscribe((retrievedValue) => {
              assert(retrievedValue.isFromCache())
              assert.equal(restBody,retrievedValue.value());
              observableCalled++;
            });

            var obs3 = herdcache.apply("notset",slowHttpRequest1Second2)
            obs3.subscribe((retrievedValue) => {
              assert(retrievedValue.isNotFromCache())
              assert.equal(restBody2,retrievedValue.value());
              observableCalled++;
            });
          },2000);

          setTimeout(() => {
            // Second
            assert.equal(called(),2,"memcached set should only have been called twice, as one value will be from cache");
            assert.equal(observableCalled,3,"both observables should have been called");
            done();
          },3500);

        },500);
      }
    );

    // Test that apply writes to the cache.
    it("Check that set is possible, and can then be retrieved from the cache",
      function(done) {
        this.timeout(5000);
        cacheEnabled = true;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var called = monkeyPatchSet(100,memcachedMock);
          var obs = herdcache.set(key,slowHttpRequest1Second)

          setTimeout(() => {
            console.log("on the get");
            var obsGet = herdcache.get(key);
            assert.equal(obsGet,obs,"Set should have added to internal cache");
          },500);

          var observableCalled=0;
          obs.subscribe((retrievedValue) => {
            console.log("SET: should be rest 1, and not cached" + retrievedValue.value() + " " + retrievedValue.isNotFromCache());
            assert(retrievedValue.isNotFromCache());
            console.log("SET: should be rest 1, and not cached" + retrievedValue.value() + " " + retrievedValue.isNotFromCache());
            assert.equal(restBody,retrievedValue.value());
            console.log("SET: should be rest 1, and not cached" + retrievedValue.value() + " " + retrievedValue.isNotFromCache());

            observableCalled++;
          });

          setTimeout(() => {
            console.log("DOING GET: " + key);

            var obs2 = herdcache.get(key,slowHttpRequest1Second2)
            obs2.subscribe((retrievedValue) => {
              console.log("SET: should be rest 1" + retrievedValue.value());
              assert(retrievedValue.isFromCache())
              assert.equal(restBody,retrievedValue.value());
              observableCalled++;
            });

            var obs3 = herdcache.apply("notset",slowHttpRequest1Second2)
            obs3.subscribe((retrievedValue) => {
              console.log("SET: should be rest 2" + retrievedValue.value());
              assert(retrievedValue.isNotFromCache())
              assert.equal(restBody2,retrievedValue.value());
              observableCalled++;
            });
          },2000);

          setTimeout(() => {
            // Second
            assert.equal(called(),2,"memcached set should only have been called twice, as one value will be from cache");
            assert.equal(observableCalled,3,"both observables should have been called");
            done();
          },4000);

        },500);
      }
    );


    //
    // Test that apply takes a predicate that determines
    // that the value cannot be added to the cache
    //
    it("Check that value cannot be written to the cache, when given predicate that does not allow it",
      function(done) {
        this.timeout(5000);
        cacheEnabled = true;
        var isCacheable = function(value) {
          if(value == restBody) {
            return true;
          } else {
            return false;
          }
        };
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var obs = herdcache.apply(key,slowHttpRequest1Second,
                                    {isSupplierValueCachablePredicate:isCacheable});

          var obs2 = herdcache.apply(key2,slowHttpRequest1Second2,
                                    {isSupplierValueCachablePredicate:isCacheable});

          var observableCalled=0;
          obs.subscribe((retrievedValue) => {
              assert(!retrievedValue.isFromCache())
              assert.equal(restBody,retrievedValue.value());
              observableCalled++;
          });

          obs2.subscribe((retrievedValue) => {
            assert(retrievedValue.isNotFromCache())
            assert.equal(restBody2,retrievedValue.value());
            observableCalled++;
          });

          setTimeout(() => {
            var obs3 = herdcache.apply(key,slowHttpRequest1Second2)
            obs3.subscribe((retrievedValue) => {
              assert(retrievedValue.isFromCache())
              assert.equal(restBody,retrievedValue.value());
              observableCalled++;
            });

            var obs4 = herdcache.apply(key2,slowHttpRequest1Second)
            obs4.subscribe((retrievedValue) => {
              assert(retrievedValue.isNotFromCache())
              assert.equal(restBody,retrievedValue.value());
              observableCalled++;
            });
          },1500);


          setTimeout(() => {
            // Second
            assert.equal(observableCalled,4,"both observables should have been called");
            done();
          },3000);

        },500);
      }
    );

   //
    // Test that apply takes a predicate that determines
    // that the value fetched from the cache cannot be used.
    //
    it("Check that value obtained from the cache cannot be used, when given predicate that does not allow it",
      function(done) {
        this.timeout(6000);
        cacheEnabled = true;
        var isValid = function(value) {
          if(value == restBody) {
            return false;
          } else {
            return true;
          }
        };
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          // This will set the value to first request and store in cache.
          var observableCalled=0;
          var obs = herdcache.apply(key,slowHttpRequest1Second);
          obs.subscribe((retrievedValue) => {
              assert(!retrievedValue.isFromCache())
              assert.equal(restBody,retrievedValue.value());
              observableCalled++;
          });

          //
          // Try to obtain key (which is in the cache),
          // but it will call the supplier, as the isValid predicate does
          // not allow it
          //
          setTimeout(() => {
            var obs2 = herdcache.apply(key,slowHttpRequest1Second2,
                          {isCachedValueValidPredicate:isValid});
            obs2.subscribe((retrievedValue) => {
              assert(retrievedValue.isNotFromCache())
              assert.equal(restBody2,retrievedValue.value());
              observableCalled++;
            });
          },1500);

          setTimeout(() => {
            var obs3 = herdcache.apply(key,slowHttpRequest1Second)
            obs3.subscribe((retrievedValue) => {
              assert(retrievedValue.isFromCache())
              assert.equal(restBody2,retrievedValue.value());
              observableCalled++;
            });
          },3000);


          setTimeout(() => {
            // Second
            assert.equal(observableCalled,3,"3 observables should have been called");
            var summary = reporter.summary();
            assert.equal(getMetricValue(summary,CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE+"_count"),3);
            assert.equal(getMetricValue(summary,CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE+"_hitcount"),2);
            assert.equal(getMetricValue(summary,CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE+"_misscount"),1);
            assert.equal(getMetricValue(summary,CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_SUCCESS_COUNTER+"_count"),2);
            assert.equal(getMetricValue(summary,CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION+"_misscount"),3);
            console.log(reporter.summary());
            done();
          },5000);

        },500);
      }
    );

    //
    // Testing that set occurs on memcached before value sent to observer
    //
    it("Returns value to observer after memcached set has occurred",
      function(done) {
        this.timeout(5000);
        var called = monkeyPatchSet(1000,memcachedMock);
        cacheEnabled = true;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var obs = herdcache.apply(key,slowHttpRequest1Second);
          var obs2 = herdcache.apply(key2,slowHttpRequest1Second,{
            waitForMemcachedSet : true
          });
          var obs3 = herdcache.apply("sundayfootball",slowHttpRequest1Second);

          var observableCalled=0;
          obs.subscribe(function(retrievedValue) {
            assert.equal(called(),0,"write to memcached should not have occurred");
            assert.equal(retrievedValue.value(),restBody);
            observableCalled++;
          });

          obs2.subscribe(function(retrievedValue) {
            assert(called()>0,"write to memcached should have occurred");
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          obs3.subscribe(function(retrievedValue) {
            assert.equal(called(),0,"write to memcached should not have occurred");
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          setTimeout(() => {
            assert.equal(observableCalled,3,"all observables should have been called");
            assert.equal(supplierCalled,3,"Supplier function should have been called 3 times");
            done();
          },3500);
        },500);
    });
  });

  describe("Get", function() {
    it("Executes only when observed",function(done) {
      cacheEnabled = true;
      this.timeout(5000);
      var called = monkeyPatchGet(1000,memcachedMock);
      setTimeout(() => {
        var observableCalled = 0;
        obs = herdcache.get(key);
        // obs.subscribe(function(retrievedValue) {
        //   observableCalled++;
        // });

        setTimeout(()=> {
          assert.equal(0,called());
          done();
        },2000);
      },500);
    });

    //
    // Check get returns null when nothing is in the cache
    // And that a subscribe on the same observable, does not invoke the observable
    //
    it("Returns observable from get request that takes time to fulfil",
      function(done) {
        // add a delay to the test
        monkeyPatchGet(1000,memcachedMock);
        this.timeout(5000);

        var observableCalled = 0;
        //
        // need to wait for autodiscovery to have run first
        // to have created the memcached client with the memcachedMock
        //
        var cacheItem = null;
        var obs = null;
        setTimeout(() => {
          obs = herdcache.get(key);
          obs.subscribe(function(retrievedValue) {
            assert.equal(null,retrievedValue.value());
            observableCalled++;
            cacheItem = retrievedValue;
          });

          // Check for herdcache throttle returning same observable
          var obs2 = herdcache.get(key);
          var obs3 = herdcache.get('NOSUCHKEY');
          assert.notEqual(obs,obs2)
          assert.notEqual(obs,obs3)

          obs2.subscribe(function(retrievedValue) {
            assert.equal(null,retrievedValue.value());
            observableCalled++;
          });
        },500)

        // Ensure calculated observable value is returned,
        // and cache not recalled.
        setTimeout(() => {
          obs.subscribe(function(val) {
            assert.equal(val,cacheItem);
          });
        },1500);

        setTimeout(() => {
          assert.equal(2,observableCalled);
          done();
        },3000);

    });

    it("Returns observable that returns an empty Cache Item",
      function(done) {
        // add a delay to the test
        monkeyPatchGet(2000,memcachedMock);
        this.timeout(5000);

        var observableCalled = 0;
        //
        // need to wait for autodiscovery to have run first
        // to have created the memcached client with the memcachedMock
        //
        setTimeout(() => {
          var obs = herdcache.get("NO_SUCH_THING");
          obs.subscribe(function(retrievedValue) {
            assert.equal(null,retrievedValue.value());
            assert.equal(false,retrievedValue.isFromCache());
            done();
          });

        },500)
    });

    it("Returns observable that returns an empty Cache Item, when cache is not enabled",
      function(done) {
        cacheEnabled = false;
        // add a delay to the test
        monkeyPatchGet(1000,memcachedMock);
        this.timeout(5000);

        var observableCalled = 0;
        //
        // need to wait for autodiscovery to have run first
        // to have created the memcached client with the memcachedMock
        //

        var obs = null;
        var cacheItem = null;
        setTimeout(() => {
          obs = herdcache.get("NO_SUCH_THING");
          obs.subscribe(function(retrievedValue) {
            cacheItem = retrievedValue;
            assert.equal(null,retrievedValue.value());
            assert.equal(false,retrievedValue.isFromCache());
          });
        },500)

        setTimeout(() => {
           obs.subscribe(function(retrievedValue) {
            assert.equal(null,retrievedValue.value());
            assert.equal(false,retrievedValue.isFromCache());
            assert.equal(cacheItem, retrievedValue);
            done();
          });
        },1500);

    });

    it("That an item can be removed from the cache",
      function(done) {
        cacheEnabled = true;
        // add a delay to the test
        this.timeout(5000);

        var observableCalled = 0;
        //
        // need to wait for autodiscovery to have run first
        // to have created the memcached client with the memcachedMock
        //
        var obs = null;
        var getObs = null;
        var cacheItem = null;
        var isDeleted = false;
        var isGetDone = false;
        var isGetAfterDeleteDone = false;

        setTimeout(() => {
          obs = herdcache.apply("NO_SUCH_THING",new Rx.Observable.of("20"));
          obs.subscribe(function(retrievedValue) {
            cacheItem = retrievedValue;
            assert.equal("20",retrievedValue.value());
            assert.equal(false,retrievedValue.isFromCache());
          });
        },500)

        var getObs = null;

        setTimeout(() => {
          var getObs = herdcache.get("NO_SUCH_THING");
          getObs.subscribe(function(retrievedValue) {
            assert.equal(true,retrievedValue.isFromCache());
            assert.equal("20",retrievedValue.value());
            isGetDone = true;
          });
        },1700);

        setTimeout(() => {
          var delObs = herdcache.clear("NO_SUCH_THING");
          delObs.subscribe(function(retrievedValue) {
            assert.equal(true,retrievedValue);
            isDeleted = true
          });
        },2200);

        setTimeout(() => {
          var getAfterDeleteObs = herdcache.get("NO_SUCH_THING");
          getAfterDeleteObs.subscribe(function(retrievedValue) {
            assert.equal(null,retrievedValue.value());
            assert.equal(false,retrievedValue.isFromCache());
            isGetAfterDeleteDone = true;
          });
        },2500);

        setTimeout(() => {
          assert.equal(isDeleted,true);
          assert.equal(isGetDone,true);
          assert.equal(isGetAfterDeleteDone,true);
          done();
        },3000)

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