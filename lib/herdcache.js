const AutoDiscovery = require('./autodiscovery');
const constants = require('./constants');
const Memcached = require('./memcached');
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
        return new Memcached(false)
    } else {
        return new Memcached(true,["localhost:11211"])
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
        console.log("should not be here")
        return cachedLookup;
    } else {
        var single = this.client.get(key)

        single.subscribe(null,null,() => {
            delete this.herdGetDict[key];
            console.log("removed key:"+key);
        });

        this.herdGetDict[key] = single;
        return single;
    }
}


module.exports = HerdCache;
