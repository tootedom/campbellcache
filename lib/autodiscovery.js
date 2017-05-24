const Rx = require('rxjs');
var Ecad = require('ecad');
var logger = require('binford-slf4j').getLogger('autodiscovery.js');
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

    var client = new Ecad({
        endpoints : options.url,
        timeout : options.timeout
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
        var updated = false;
        if (err) {
            logger.debug("Unable to obtain lists of servers from configuration server, error: {0}",err);
        }
        else {
            logger.debug("Hosts returned by configuration server: {0}",hosts);
            if(!sameHosts(hosts,!notifyOnNoHosts)) {
                logger.debug('hosts changed from: "{0}", to "{1}"',currentHostsLists,hosts);
                currentHostsLists = hosts.sort();
                hostsChangedObservable.next(hosts);
            } else {
                logger.debug('hosts unchanged.  Current: "{0}", Found: "{1}"',currentHostsLists,hosts);
            }
        }
    }

    function sameHosts(hosts,sameIfEmpty) {

        if(!hosts || hosts.length==0) {
            if (currentHostsLists.length==0) {
                return true;
            } else {
                return sameIfEmpty;
            }
        }

        if(currentHostsLists.length != hosts.length) {
            return false;
        }

        var sortedHosts = hosts.sort();
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
    return this.hostsChangedObservable.subscribe(cb);
}

AutoDiscovery.prototype.shutdown = function(cb) {
    this.hostsChangedObservable.complete()
    this.endAutoDiscovery.next('');
}



module.exports = AutoDiscovery;