/**
 * Module dependencies
 */

var HerdCache = require("./lib/herdcache");
var CacheItem = require('./lib/cacheitem');


var HerdCacheClient = new HerdCache({
    autodiscovery:true
})

var item = new CacheItem("string",null,false);


console.log(item);

item.key = "lkjlkj";




console.log(HerdCacheClient.config);


var single = HerdCacheClient.get('val');
console.log("troublelelkjlkjlkj" + single);
single.subscribe((item) => console.log("tiem: " + item));

setTimeout(() => {
    single.subscribe((item) => console.log("tiem: " + item));
},1000);
process.on( 'SIGINT', function() {
  console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
  // some other closing procedures go here
  process.exit( );
})


