const Logging = require('./testlogging');
const chai = require('chai');
const expect = chai.expect;
const assert = require('assert');
const metrics = require('metrics');
const metricNames = require('../lib/cachemetricstrings');

const MetricRecorder = require('../lib/metricrecorder');



describe('MetricRecorder', function() {

    var ns = "org.greencheeck.campbellcache";

    function getMetricValue(metrics,name) {
        return metrics[ns][name]['count'];
    }

    beforeEach(function() {
    });

    afterEach(function() {
    });

    describe("cacheMiss", function() {
        it("Records cache misses to counter and meter",
        function(done) {
            var report = new metrics.Report;
            var recorder = new MetricRecorder({
                prefix: ns+".cacheMissTest_",
                registries: report
            })

            recorder.logCacheMiss("somethingforthekey",metricNames.CACHE_TYPE_ALL);
            recorder.logCacheMiss("somethingforthekey",metricNames.CACHE_TYPE_ALL);
            recorder.logCacheMiss("somethingforthekey",metricNames.CACHE_TYPE_ALL);

            summary = report.summary();

            assert(summary.hasOwnProperty(ns),"should have metric namespace:" + ns);
            assert.equal(3,getMetricValue(summary,"cacheMissTest_"+metricNames.CACHE_TYPE_ALL+"_misscount"));
            assert.equal(3,getMetricValue(summary,"cacheMissTest_"+metricNames.CACHE_TYPE_ALL+"_missrate"));
            done();
            console.log(report.summary());

        });
    });

    describe("cacheHit", function() {
        it("Records cache hits to counter and meter",
        function(done) {
            var report = new metrics.Report;
            var recorder = new MetricRecorder({
                prefix: ns+".cacheHitTest_",
                registries: report
            })

            recorder.logCacheHit("somethingforthekey",metricNames.CACHE_TYPE_ALL);
            recorder.logCacheHit("somethingforthekey",metricNames.CACHE_TYPE_ALL);
            recorder.logCacheHit("somethingforthekey",metricNames.CACHE_TYPE_ALL);

            summary = report.summary();

            assert(summary.hasOwnProperty(ns),"should have metric namespace:" + ns);
            assert.equal(3,getMetricValue(summary,"cacheHitTest_"+metricNames.CACHE_TYPE_ALL+"_hitcount"));
            assert.equal(3,getMetricValue(summary,"cacheHitTest_"+metricNames.CACHE_TYPE_ALL+"_hitrate"));
            done();
            console.log(report.summary());

        });
    });
});


