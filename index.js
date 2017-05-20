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


var single = HerdCacheClient.get('mykey');
console.log("troublelelkjlkjlkj" + single);
single.subscribe((item) => console.log("ITEM: " + item),null,()=>console.log("complete1"));
single.subscribe((item) => console.log("ITEM2: " + item),null,()=>console.log("complete2"));
single.subscribe((item) => console.log("ITEM3: " + item),null,()=>console.log("complete3"));
single.subscribe((item) => console.log("ITEM4: " + item),null,()=>console.log("complete4"));
console.log("after subscribe init")
setTimeout(() => {
    single.subscribe((item) => console.log("tiem: " + item)
    ,
    null,
    (item) => console.log("complete : " + item)
    );
},5000);
process.on( 'SIGINT', function() {
  console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
  // some other closing procedures go here
  process.exit( );
})


