var assert = require('assert');
var AutodiscoveryServer = require('./autodiscovery-server');
var AutoDiscovery = require('../lib/autodiscovery');
var fs = require('fs');

describe('autodiscovery', function() {
    var testServer;
    var Autodiscovery;

    afterEach(function() {
        console.log("Shutting down");
        testServer.close();
        Autodiscovery.close();
    });

    describe("Notified Of Hosts", function() {
        it("Is Notified When registered before initial discovery", function(done) {
            this.timeout(5000);
            var payload = fs.readFileSync(__dirname + '/fixtures/single', 'utf8');

            testServer = new AutodiscoveryServer(payload);

            Autodiscovery = new AutoDiscovery({
                intervalInMs: 1000
            });

            var hosts;

            Autodiscovery.register(function(discoveredHosts) {
                hosts = discoveredHosts;
            });

            setTimeout(()=> {
                assert.equal("lit-ca-1sfttco9eo1j2.a9z8qi.0001.use1.cache.amazonaws.com:11211",hosts[0]);
                done();
            },2000);
        });

        it("Is Notified When registered after initial discovery", function(done) {
            this.timeout(5000);
            var payload = fs.readFileSync(__dirname + '/fixtures/single', 'utf8');

            testServer = new AutodiscoveryServer(payload);

            Autodiscovery = new AutoDiscovery({
                intervalInMs: 1000
            });

            var hosts;

            setTimeout(() => {
                Autodiscovery.register(function(discoveredHosts) {
                    hosts = discoveredHosts;
                });
            },2000);

            setTimeout(()=> {
                assert.equal("lit-ca-1sfttco9eo1j2.a9z8qi.0001.use1.cache.amazonaws.com:11211",hosts[0]);
                done();
            },4000);
        });

        it("Is Notified Only with last update when registered after initial discovery", function(done) {
            this.timeout(5000);
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

            testServer = new AutodiscoveryServer(payload);

            Autodiscovery = new AutoDiscovery({
                intervalInMs: 500
            });

            var hosts;

            setTimeout(() => {
                Autodiscovery.register(function(discoveredHosts) {
                    hosts = discoveredHosts;
                });
            },2000);

            setTimeout(()=> {
                console.log(hosts);
                assert.equal(3,hosts.length);
                assert.equal("foo.a8ssop.0001.use1.cache.amazonaws.com:11211",hosts[0]);
                assert.equal("foo.a8ssop.0002.use1.cache.amazonaws.com:11211",hosts[1]);
                assert.equal("foo.a8ssop.0003.use1.cache.amazonaws.com:11211",hosts[2]);
                done();
            },4000);
        });
    });
});