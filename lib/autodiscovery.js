const Rx = require('rxjs');
var Ecad = require('ecad');
var {ENV_EC_CONFIG_URL} = require('./constants');


function AutoDiscovery(options) {

    options.intervalInMs = options.intervalInMs || 60000;
    options.url = options.url || ENV_EC_CONFIG_URL;
    options.timeout = options.timeout || 3000;
    options.notifyOnNoHosts = options.notifyOnNoHosts || true;

    if (typeof options.url == 'undefined') {
        throw new Error("No Autodiscovery URL!  Autodiscovery Requires a URL of the elasticache configuration endpoint.");
    }

    var notifyOnNoHosts = options.notifyOnNoHosts;
    var hostsChangedObservable = new Rx.ReplaySubject(1);
    var endAutoDiscovery = new Rx.Subject().take(1);
    var currentHostsLists = [];

    console.log("connection: " + options.url)
    var client = new Ecad({
        endpoints : options.url
    });

    this.hostsChangedObservable = hostsChangedObservable;
    this.endAutoDiscovery = endAutoDiscovery;
    this.discoveryClient = client;
    this.periodicDiscoveryEvent = Rx.Observable.interval(options.intervalInMs)
                                            .timeInterval()
                                            .takeUntil(endAutoDiscovery);

    this.periodicDiscoverySubscription = this.periodicDiscoveryEvent.subscribe(
        function(ok) {
            client.fetch(updateHosts);
        }
    )


    function updateHosts(err,hosts) {
        console.log("checking for hosts")
        var updated = false;
        if (err) {
            console.log('error' + err);
            // hostsChangedObservable.next('dldldldldld');
        }
        else {
            console.log('checking hosts');
            if(!sameHosts(hosts,!notifyOnNoHosts)) {
                currentHostsLists = hosts.sort();
                console.log('hosts changed: ' + hosts);
                hostsChangedObservable.next(hosts);
            }
        }
    }

    function sameHosts(hosts,sameIfEmpty) {
        console.log("discovered: " + hosts);
        console.log("current: " + currentHostsLists);
        if(!hosts || hosts.length==0) {
            if (currentHostsLists.length==0) {
                return true;
            } else {
                return sameIfEmpty;
            }
        }
        console.log("checking length");
        console.log(Array.isArray(hosts));
        console.log(Array.isArray(currentHostsLists));
        console.log("current hosts: " + currentHostsLists.length);
        console.log("hosts: " + hosts.length);
        if(currentHostsLists.length != hosts.length) {
            return false;
        }

        var sortedHosts = hosts.sort();
        console.log("checking sorted");
        for(var i = 0;i<currentHostsLists.length;i++) {
            if(currentHostsLists[i] != sortedHosts[i]) {
                return false;
            }
        }
        return true;
    }
}



/**
 * register a listener on the observable for changes in the
 * discovered hosts.
 */
AutoDiscovery.prototype.register = function(cb) {
    console.log("registering to " + this.hostsChangedObservable);
    return this.hostsChangedObservable.subscribe(cb);
}

AutoDiscovery.prototype.close = function(cb) {
    this.hostsChangedObservable.complete()
    this.endAutoDiscovery.next('');
}



module.exports = AutoDiscovery;