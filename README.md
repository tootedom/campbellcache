# CampbellCache

```sh
npm install campbellcache
```

* auto-gen TOC:
{:toc}

----

The cache borrows heavily from the concepts laid out in [spray-caching](http://spray.io/documentation/1.2.1/spray-caching/).

An equivalent library to Campbell Cache for java is that of [herdcache](https://github.com/tootedom/herdcache).  Originally I was going to name this herdcache-js.  However, my White Campbell ducks got taken by a fox; so in honour of Henrietta and Puddle I renamed it (think of it as a Herd of Ducks :-)


CampbellCache is intended to be used when caching items in Memcached, especially that of AWS's
implementation: [Elasticache](http://docs.aws.amazon.com/AmazonElastiCache/latest/UserGuide/AutoDiscovery.html).


It is the caching of a value against a key. i.e. "Customer123", which you will retrieve from the cache later on, rather than having to do an expensive operation to obtain the information for "Customer123"

When using campbellcache, the concept is to execute a function that generates the value only if the item is not in the cache.  If a subsequent lookup for the same key is currently running, rather than having 2 lookups executing for that same key, only 1 will be executing.  With both requests for that same key, being satisfied by the 1 execution (either by memcached cache hit lookup or the execution of the function to generate the value).

Rather than the tradition method of performing the following yourself, campbellcache does this execution for you:

1. lookup 'key' in cache
2. 'key' is not in cache
3. execute an expensive operation (call a 3rd party system)
4. store item in cache under 'key'

When performing the above manually, If 2 requests are running concurrently for the 'key', 3. has not completed for the 1st request.  Then you would have 2 requests running step 3.  With campbellcache, you would only have 1.

This having multiple consumers waiting on 1 producer, is achieved by the cache returning an [RxJS Observable](https://github.com/Reactive-Extensions/RxJS/blob/master/doc/api/core/observable.md).  The consumer then subscribes to be notified of the value (unsubscribing after they have recieved the value).

The value returned from the Observable is that of a [CacheItem](https://github.com/tootedom/campbellcache/blob/master/lib/cacheitem.js).  This wrapper object, provides methods that allow you let you know if the item is from the cache or not, or have a default value if nothing was returned:

- isFromCache()
- isNotFromCache()
- value("default if null") #returns the default if null
- value() #will return null
- getKey()
- isError() #if there was an error
- hasValue() #check if null

This scenario of having many requests to a the same cache key (e.g. a resource URI) arriving at the same time. I.e. a popular news story or similar, is known a stampeading/thundering herd.  The result being: you have a lot of requests to the same memcached server, at the same time, to fetch the same value. This puts huge load on that 1 memcached server, which could result in an outage. If the item is not in the cache all the requests end up hitting the upstream services that generate the cache value; which again couple cripple that upstream service.

Returning an Observable from the cache means that multiple resources for a missing cache value that hasn’t been calculated, wait on the same Observable that is executing for the initial/first request for the cache key.

Returning a Observable also means that one request for a cache value from memcached can satisfy many requests.

***HerdCache is not a distributed caching library.  The herd process only works within the 1 running proccess.  If you have 2 EC2 Instances/Processes running campbellcache, the protection mechanism is per Instance/Process*** 

----

## Creating the Cache object

Herdcache can be used against a local memcached or run against AWS memcache elasticache (utilising the auto discovery of hosts).

### Local Memcached

The below shows how to connect to 2 local memcached by providing an array of connections

```nodejs
const campbellcache = new CampbellCache({
    autodiscovery: false,
    hosts: ["127.0.0.1:11211","127.0.0.1:11212"],
})
```


### AWS Elasticache

The easiest way to use elasticache is to set the environment variable: `EC_MEMCACHED_CONFIGURL` to the configuration url of your elasticache cluster:

```bash
export EC_MEMCACHED_CONFIGURL=domtest.xxxxx.cfg.use1.cache.amazonaws.com
```

If you have configured your elasticache cluster on a different port do:

```bash
export EC_MEMCACHED_CONFIGURL=domtest.xxxxx.cfg.use1.cache.amazonaws.com:11211
```

Once you have the above set you create the client as follows:


```nodejs
const campbellcache = new CampbellCache({
    autodiscovery: true,
    autodiscovery_intervalInMs : 60000,
    autodiscovery_startIntervalInMs : 10000,
})
```

----

## Methods

There's a few methods in campbell cache that you might interact with, buy by far the most likely and recommended is `apply`:

### Apply

```nodejs
apply(key,supplier,options)
```

Supplier is a function that returns an Observable:
```nodejs
    function deathByBoom() {
        return new Rx.Observable.create(function(observer) {
                        observer.next("You Got Nuked by the BoomStick"))
                    }).take(1).shareReplay();
    }

    campbellcache.apply("GearsOfWarDeath",deathByBoom);
```

The supplier function is _only_ executed if an item is not found in the cache
that is deemed useable by the `isCachedValueValidPredicate` function of the options dict (If this function is not provided it is deemed usable).

The lookup in memcached for an item, and the execution of the Supplier, are only executed when a subscribe, registered for wishing to be notified of the outcome.

The supplier function returns an Rx.Observable that performs the operation of calculating the value that will be written to the cache.  In the above example the value is that of the string `"You Got Nuked by the BoomStick"`.  This string will be passed to the `isSupplierValueCachablePredicate` function to determine if the value should be cached or not (If this function is not provided it is deemed cacheable)

If you do not register your interest in the outcome of the Observable returned by apply, nothing will execute.  The Observable is lazy

```nodejs
var gearsObservable = apply("GearsOfWarDeath",supplier,options)
```

In the above nothing will be execute.  The lookup in memcached, nor the execution of the supplier

```nodejs
var gearsDeathObservable = apply("GearsOfWarDeath",supplier,options)

// Register Interest and kick of the Observable
var sub = gearsDeathObservable.subscribe(function(deathBy) {
    console.log('Died By:' + deathBy.value());
});
```

_*NOTE* : you are responsible for unsubscribing the subscriber_

The options is dictionary that configures how the `apply` function operates:

```nodejs
     {
        ttl : 5,
        isSupplierValueCachablePredicate:<boolean function(item)>,
        isCachedValueValidPredicate: <boolean function(item)>,
        waitForMemcachedSet : true|false,
     };
```

- ttl : The number of seconds the item should be stored in the cache.
- isSupplierValueCachablePredicate : A function that takes the item from the                                          observable and return true if the item is cachable.
- isCachedValueValidPredicate : If the item retrieved from the cache is useable
- waitForMemcachedSet : If the supplier was called to generate a value, shoudl we wait for the item to be written to memcached before waiting notify observes of the value.



## Examples

A set of examples that demonstrate the functionality of campbell cache.

### Calling google.co.uk

The below demonstrates the calling of www.google.co.uk, caching the result for 10 seconds.

The www.google.co.uk request only starts after 1 second.  Basically a simulation a slow http requests that has a 1+ second delay.

This means that if we run 50 concurrent connections, Only 1 request will result in calling www.google.co.uk, the other 49 will be waiting on that 1 request completing, and so forth.  Then for 10 seconds everything will be quick, until the same occurs again.  However, www.google.com is only called by 1 request every 10 seconds.

If we perform a load test for 120seconds, google will be called only 11 or 12 times

```bash
 wrk -c 50 -t 50 -d 120s http://127.0.0.1:3000/dom
Running 2m test @ http://127.0.0.1:3000/dom
  50 threads and 50 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency   177.30ms  228.32ms   1.45s    91.74%
    Req/Sec     8.80      2.21    20.00     88.53%
  48201 requests in 2.00m, 2.05GB read
Requests/sec:    401.39
Transfer/sec:     17.52MB
```

Here is an example using Hapi.js and request promise.   Please see the `onRequest` and `onPreResponse` which add the Observable subscriber to a list of subscribers, that are to be closed when the request finishes.


```nodejs
const Joi = require('joi');

const requestpromise = require('request-promise');

const Hapi = require('hapi');

const Rx = require('rxjs');

var slf4j = require('binford-slf4j');
var binfordLogger = require('binford-logger');

slf4j.setLoggerFactory(binfordLogger.loggerFactory);
slf4j.loadConfig({
    level: slf4j.LEVELS.DEBUG,
    appenders:
        [{
            appender: binfordLogger.getDefaultAppender()
        }]
});

const CampbellCache = require('campbellcache');

const campbellcache = new CampbellCache({
    autodiscovery: false,
    autodiscovery_oldClientTTL: 2000,
    hosts: ["127.0.0.1:11211"],
})

const server = new Hapi.Server({
    connections: {
        routes: {
            timeout: {
                server: 5000 //ms
                //socket: 1000 ms
            }
        }
    }
}
);

function slowGoogleObservable() {
    return new Rx.Observable.create(function(observer) {
        setTimeout(() => {
            var rep = requestpromise(
                                    {
                                        json: true,
                                        resolveWithFullResponse: true,
                                        uri: 'http://www.google.co.uk',
                                        timeout:10000
                                    }
            );

            rep.then(function (responseObj) {
                var body = responseObj.body;
                observer.next(body);
                observer.complete();
            })
            rep.catch(function (err) {
                observer.error(err);
                observer.complete();
            });
        },1000)
    }).take(1).shareReplay();
}

function addSubscriptionToRequest(subscription, request) {
    request.app.observable_subscriptions.push(subscription);
    console.log(request.app.observable_subscriptions);
}

server.connection({ port: 3000, host: 'localhost' });

server.ext('onRequest',(request,reply) => {
    // add empty list of subscriptions
    request.app.observable_subscriptions = [];
    reply.continue();
});

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
        reply('Hello, world!');
    }
});

server.route({
    method: 'GET',
    path: '/{name}',
    config: {
      validate: {
        params: {
          name: Joi.string()
        },
      },
    },
    handler: function (request, reply) {
        const log = request.log.bind(request);

        // write into cache
        var obs = campbellcache.apply("google",slowGoogleObservable, {
            ttl: 10
        });

        var sub = obs.subscribe(function(httpBody) {
            reply('Hello, ' + encodeURIComponent(request.params.name) + '!' + httpBody.value());
        });

        addSubscriptionToRequest(sub,request);
    }
});

server.ext('onPreResponse',(request,reply) => {
    // Make sure we unsubscribe any subscriptions
    for (let subscription of request.app.observable_subscriptions) {
        if (subscription) {
            console.log("Unsubscribing: " + subscription);
            subscription.unsubscribe();
        }
    }
    reply.continue();
});

server.start((err) => {

    if (err) {
        throw err;
    }
    console.log(`Server running at: ${server.info.uri}`);
});

```


### More Docs Coming Soon....