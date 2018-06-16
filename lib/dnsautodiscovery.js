const Rx = require('rxjs');
const dns = require('dns');
const CachingMap = require('caching-map');

const logger = require('binford-slf4j').getLogger('dnsautodiscovery.js');
const {ENV_EC_CONFIG_URL} = require('./constants');

const isValidAddress = address => address !== '127.0.53.53';

const cache = new CachingMap()

function getOrDefault(val,defaultVal) {
    return (typeof val !== 'undefined') ? val : defaultVal;
}

function DNSAutoDiscovery(options) {

    options.intervalInMs = options.intervalInMs || 60000;
    options.startIntervalInMs = options.startIntervalInMs || 0;
    options.url = options.url || ENV_EC_CONFIG_URL;

    url = undefined
    port = 11211
    if (options.url.indexOf(':')!=-1) {
        urlAndPort = options.url.split(":")
        url = urlAndPort[0]
        port = urlAndPort[1]
    } else {
        url = options.url
    }

    options.timeoutInMs = options.timeoutInMs || 3000;
    options.notifyOnNoHosts = getOrDefault(options.notifyOnNoHosts,true);

    if (typeof url == 'undefined') {
        throw new Error("No Autodiscovery URL!  Autodiscovery Requires a URL of the elasticache configuration endpoint.");
    }

    var notifyOnNoHosts = options.notifyOnNoHosts;
    var hostsChangedObservable = new Rx.ReplaySubject(1);
    var endAutoDiscovery = new Rx.Subject().take(1);
    var currentHostsLists = [];

    this.hostsChangedObservable = hostsChangedObservable;
    this.endAutoDiscovery = endAutoDiscovery;
    this.periodicDiscoveryEvent = Rx.Observable.timer(options.startIntervalInMs,options.intervalInMs)
                                            .takeUntil(endAutoDiscovery);

    this.periodicDiscoverySubscription = this.periodicDiscoveryEvent.subscribe(
        function(ok) {
            lookup(url,port)
        }
    )

    function lookup(url,port) {
        dns.lookup(url, { all: true, family: 4}, (err, addresses) => {
            if (err && (err.code === 'ENOENT' || err.code === 'ENOTFOUND')) {
                updateHosts(null,cache.get(url))
            } else {
                var validAddresses = [];
                if (addresses.length>0) {
                    addresses.forEach((a) => {
                        if (isValidAddress(a['address'])) {
                            validAddresses.push(a['address']+":"+port)
                        }
                    })

                    if(validAddresses.length>0) {
                        logger.debug('DNS lookup for "{0}" returned addresses: {1}',url,validAddresses);
                        cache.set(url,validAddresses)
                        updateHosts(null,validAddresses)
                    } else {
                        logger.warn('DNS lookup for "{0}" returned collision addresses',url);
                        updateHosts(null,[])
                    }
                } else {
                    logger.warn('DNS lookup for "{0}" return no addresses',url);
                    updateHosts(null,[])
                }
            }
        })
    }

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
DNSAutoDiscovery.prototype.register = function(cb) {
    return this.hostsChangedObservable.subscribe(cb);
}

DNSAutoDiscovery.prototype.shutdown = function(cb) {
    this.hostsChangedObservable.complete()
    this.endAutoDiscovery.next('');
}



module.exports = DNSAutoDiscovery;