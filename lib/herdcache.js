const AutoDiscovery = require('./autodiscovery');
const constants = require('./constants');
const ObservableMemcached = require('./observable-memcached');
const Rx = require('rxjs');

function HerdCache(options) {
    options.autodiscovery = options.autodiscovery || false;
    options.autodiscovery_timeout = options.timeout;
    options.autodiscovery_interval = options.autodiscovery_interval;

    this.autodiscovery_enabled = options.autodiscovery;
    this.client = new _createClient(["localhost:11211"])
    this.herdApplyDict = {};
    this.herdGetDict = {};

    console.log(options);
    if(options.autodiscovery) {
        this.autodiscovery = new AutoDiscovery({
            url: options.autodiscovery_url,
            intervalInMs: options.autodiscovery_interval,
            timeout: options.autodiscovery_timeout,
        });
        this.autodiscovery.register(() => console.log("hosts updated"));
        console.log(this.autodiscovery);
    } else {
        options.endpoints = _parseEndpoint(options.endpoint);

        if(options.endpoints.length==0) {
            // Sort out the no operation client
            throw new Error("No memcmached endpoints defined.  No Op Client is going to be defined!");
        }
    }

    return this;
};

function _createClient(hosts,options) {
    if(hosts.length == 0) {
        return new ObservableMemcached(false)
    } else {
        return new ObservableMemcached(true,["localhost:11211"])
    }
}


function _parseEndpoint(endpoint) {
    if (endpoint) {
        if (Array.isArray(options.endpoints)) {
            return options.endpoints
        } else {
            return [options.endpoints]
        }
    } else {
        return [];
    }
}



HerdCache.prototype.close = function() {
    if(this.autodiscovery_enabled) {
        // stop autodiscovery
        if(this.autodiscovery) {
            this.autodiscovery.close();
        }
        // close client
    }
}


HerdCache.prototype.get = function(key) {
    var cachedLookup = this.herdGetDict[key]
    if(cachedLookup) {
        return cachedLookup;
    } else {
        var single = this.client.get(key)
        this.herdGetDict[key] = single;

        // Add remove observer
        single.subscribe(null,null,() => {
            delete this.herdGetDict[key];
            console.log("removed key:"+key);
        });

        return single;
    }
}


module.exports = HerdCache;
