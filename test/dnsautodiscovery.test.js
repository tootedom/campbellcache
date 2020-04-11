const Logging = require('./testlogging');
Logging.initialize();
const dns = require('dns');
var chai = require('chai');
var expect = chai.expect;

// Store reference to original dns.lookup function
const nativeDnsLookup = dns.lookup;


var assert = require('assert');
var AutoDiscovery = require('../lib/dnsautodiscovery');
var fs = require('fs');


describe('autodiscovery', function() {

    process.env.EC_CONFIG_URL = "";
    var testServer;
    var Autodiscovery;

    afterEach(function() {
        console.log("Shutting down");
        Autodiscovery.shutdown();
        dns.lookup = nativeDnsLookup;
    });

    describe("Notified Of Hosts", function() {
        it("Is Notified When registered before initial discovery", function(done) {

            this.timeout(5000);

            dns.lookup = (hostname, options, callback) => {
                callback(null,[{"address":"127.0.0.1","family":4 },{"address":"127.0.0.2","family":4}])
            }

            Autodiscovery = new AutoDiscovery({
                intervalInMs: 1000,
                url: "127.0.0.1:11211"
            });

            setTimeout(()=> {
                dns.lookup = (hostname, options, callback) => {
                    callback(null,[{"address":"127.0.0.10","family":4 },{"address":"127.0.0.4","family":4}])
                }
            },2000)

            var hosts;

            Autodiscovery.register(function(discoveredHosts) {
                hosts = discoveredHosts;
            });

            setTimeout(()=> {
                assert.equal("127.0.0.10:11211",hosts[0]);
                assert.equal("127.0.0.4:11211",hosts[1]);
                done();
            },4000);
        });

        it("Original Cached Addresses are used when collision address returned", function(done) {

            this.timeout(5000);

            dns.lookup = (hostname, options, callback) => {
                callback(null,[{"address":"127.0.0.1","family":4 },{"address":"127.0.0.2","family":4}])
            }

            Autodiscovery = new AutoDiscovery({
                intervalInMs: 1000,
                url: "127.0.0.1:11211",
                notifyOnNoHosts: false
            });

            setTimeout(()=> {
                dns.lookup = (hostname, options, callback) => {
                    callback(null,[{"address":"127.0.53.53","family":4 },{"address":"127.0.53.53","family":4}])
                }
            },2000)

            var hosts;

            Autodiscovery.register(function(discoveredHosts) {
                hosts = discoveredHosts;
            });

            setTimeout(()=> {
                assert.equal("127.0.0.1:11211",hosts[0]);
                assert.equal("127.0.0.2:11211",hosts[1]);
                done();
            },4000);
        });

        it("Empty DNS returned", function(done) {

            this.timeout(5000);

            dns.lookup = (hostname, options, callback) => {
                callback(null,[{"address":"127.0.19.1","family":4 },{"address":"127.0.19.2","family":4}])
            }

            Autodiscovery = new AutoDiscovery({
                intervalInMs: 1000,
                url: "127.0.0.1:11211",
                notifyOnNoHosts: false
            });

            setTimeout(()=> {
                dns.lookup = (hostname, options, callback) => {
                    callback(null,[])
                }
            },2000)

            var hosts;

            Autodiscovery.register(function(discoveredHosts) {
                hosts = discoveredHosts;
            });

            setTimeout(()=> {
                assert.equal("127.0.19.1:11211",hosts[0]);
                assert.equal("127.0.19.2:11211",hosts[1]);
                done();
            },4000);
        });

        it("Throws an error if no url is provided to autodiscovery",
            function(done) {
                var error
                try {
                    Autodiscovery = new AutoDiscovery({
                        intervalInMs: 500
                    });
                } catch(e) {
                    error = e;
                }

                expect(error).to.be.an.instanceof(Error);
                done();
            }
        );
    });
});