# herdcache-js

```sh
npm install herdcache-js
```

(beta)

The cache borrows heavily from the concepts laid out in [spray-caching](http://spray.io/documentation/1.2.1/spray-caching/).

Herdcache is intended to be used when caching items in Memcached, especially that of AWS's
implementation: [Elasticache](http://docs.aws.amazon.com/AmazonElastiCache/latest/UserGuide/AutoDiscovery.html).

It is the caching of a value against a key. i.e. "Customer123", which you will retrieve from the cache later on, rather than having to do an expensive operation to obtain the information for "Customer123"

When using herdcache, the concept is to execute a function that generates the value only if the item is not in the cache.  If a subsequent lookup for the same key is currently running, rather than having 2 lookups executing for that same key, only 1 will be executing.  With both requests for that same key, being satisfied by the 1 execution (either by memcached cache hit lookup or the execution of the function to generate the value).

Rather than the tradition method of performing the following yourself, herdcache does this execution for you:

1. lookup 'key' in cache
2. 'key' is not in cache
3. execute an expensive operation (call a 3rd party system)
4. store item in cache under 'key'

When performing the above manually, If 2 requests are running concurrently for the 'key', 3. has not completed for the 1st request.  Then you would have 2 requests running step 3.  With herdcache, you would only have 1.

This having multiple consumers waiting on 1 producer, is achieved by the cache returning an [RxJS Observable](https://github.com/Reactive-Extensions/RxJS/blob/master/doc/api/core/observable.md).  The consumer then subscribes to be notified of the value (unsubscribing after they have recieved the value).

The value returned from the Observable is that of a [CacheItem](https://github.com/tootedom/herdcache-js/blob/master/lib/cacheitem.js).  This wrapper object, provides methods that allow you let you know if the item is from the cache or not, or have a default value if nothing was returned:

- isFromCache()
- isNotFromCache()
- value("default if null") #returns the default if null
- value() #will return null
- getKey()
- hasValue() #check if null


This scenario of having many requests to a the same cache key (e.g. a resource URI) arriving at the same time. I.e. a popular news story or similar, is known a stampeading/thundering herd.  The result being: you have a lot of requests to the same memcached server, at the same time, to fetch the same value. This puts huge load on that 1 memcached server, which could result in an outage. If the item is not in the cache all the requests end up hitting the upstream services that generate the cache value; which again couple cripple that upstream service.

Returning an Observable from the cache means that multiple resources for a missing cache value that hasn’t been calculated, wait on the same Observable that is executing for the initial/first request for the cache key.

Returning a Observable also means that one request for a cache value from memcached can satisfy many requests.

***HerdCache is not a distributed caching library.  The herd process only works within the 1 running proccess.  If you have 2 EC2 Instances/Processes running herdcache, the protection mechanism is per Instance/Process*** 


## Examples

A set of examples that demonstrate the functionality of herd

### Calling google.co.uk

```nodejs
require('heapdump');

const Joi = require('joi');

const requestpromise = require('request-promise');

const Hapi = require('hapi');

const Rx = require('rxjs');

const HerdCache = require('herdcache-js');

const herdcache = new HerdCache({
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

server.connection({ port: 3000, host: 'localhost' });

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
        reply('Hello, world!');
    }
});

function googleObservable() {
    return Rx.Observable.create(function(observer) {
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
            }
        ,1000);
    }).take(1);
}

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
        var obs = herdcache.apply("google",googleObservable, {
            ttl: 5
        });

        obs.subscribe(function(httpBody) {
              reply('Hello, ' + encodeURIComponent(request.params.name) + '!' + httpBody.value());
              this.unsubscribe();
        });

    }
});

server.start((err) => {

    if (err) {
        throw err;
    }
    console.log(`Server running at: ${server.info.uri}`);
});
```


### Observable That Takes Time