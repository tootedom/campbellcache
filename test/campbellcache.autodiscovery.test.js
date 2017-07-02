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
var CampbellCache = require('../lib/campbellcache');
var fs = require('fs');

var AutodiscoveryServer = require('./autodiscovery-server');


describe('CampbellCache', function() {
  var memcachedMock;
  var memcachedMockOriginalGet;
  var memcachedMockOriginalSet;
  var InMemoryObservableMemcached;
  var EnabledObservableMemcached;
  var DisabledObservableMemcached;
  var campbellcache;
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

    var payload = [
        fs.readFileSync(__dirname + '/fixtures/single', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
        fs.readFileSync(__dirname + '/fixtures/multiple', 'utf8'),
    ];

    testAutodiscoveryServer = new AutodiscoveryServer(payload);


    reporter = new metrics.Report;
    memcachedMock = require('memcached-mock');
    InMemoryObservableMemcached = proxyquire('../lib/observable-memcached', {memcached: memcachedMock});
    campbellcache = new CampbellCache({
      autodiscovery : true,
      autodiscovery_url : "127.0.0.1:11211",
      autodiscovery_intervalInMs: 1000,
      autodiscovery_startIntervalInMs: 1000,
      autodiscovery_oldClientTTL: 1000,
      metrics_registries : reporter,
      metrics_prefix : "org.greencheek."
    })
  });

  afterEach(function() {
    testAutodiscoveryServer.shutdown();
    campbellcache.flush();
    campbellcache.shutdown();
  });

  describe("apply", function() {
    it("closes old client after autodiscovery", function(done) {
      var oldClient = campbellcache.client;
      var oldClient2 = null;
      this.timeout(5000);
      // Run in a set timeout to allow autodiscover to return disabled cache
      setTimeout(() => {
        console.log("checking new client")
        var newClient = campbellcache.client;

        assert.notEqual(newClient,oldClient,"we should have a different client")
        assert.equal(oldClient.isAvailable(),false);
        oldClient2 = newClient;
      },1800)


      setTimeout(() => {
        var newClient = campbellcache.client;
        assert.notEqual(newClient,oldClient2,"we should have a different client")
        assert.notEqual(oldClient2,oldClient,"we should have a different clients for the 2 old client")
        assert.equal(oldClient.isAvailable(),false);
        assert.equal(oldClient2.isAvailable(),false);
        done();
      },4000)
    });

  });


});
