const Rx = require('rxjs');
const Ecad = require('ecad');
const logger = require('./log');
const {ENV_EC_CONFIG_URL} = require('./constants');



function getOrDefault(val,defaultVal) {
    return (typeof val !== 'undefined') ? val : defaultVal;
}

function AutoDiscovery(options) {

    options.intervalInMs = options.intervalInMs || 60000;
    options.startIntervalInMs = options.startIntervalInMs || 0;
    options.url = options.url || ENV_EC_CONFIG_URL;

    if (!~options.url.indexOf(':')) {
        options.url = options.url + ":11211";
    }

    options.timeoutInMs = options.timeoutInMs || 3000;
    options.notifyOnNoHosts = getOrDefault(options.notifyOnNoHosts,true);

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
    this.periodicDiscoveryEvent = Rx.Observable.timer(options.startIntervalInMs,options.intervalInMs)
                                            .takeUntil(endAutoDiscovery);

    this.periodicDiscoverySubscription = this.periodicDiscoveryEvent.subscribe(
        function(ok) {
            client.fetch(updateHosts);
        }
    )

    function updateHosts(err,hosts) {
        var updated = false;
        if (err) {
            logger.log('debug',"Unable to obtain lists of servers from configuration server, error: %s", err);
        }
        else {
            logger.log('debug',"Hosts returned by configuration server: %s",hosts);
            if(!sameHosts(hosts,!notifyOnNoHosts)) {
                logger.log('debug','hosts changed from: "%s", to "%s"',currentHostsLists,hosts);
                currentHostsLists = hosts.sort();
                hostsChangedObservable.next(hosts);
            } else {
                logger.log('debug','hosts unchanged.  Current: "%s", Found: "%s"',currentHostsLists,hosts);
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