/**
 * Module dependencies
 */

var HerdCache = require("./lib/herdcache");


var HerdCacheClient = new HerdCache({
    autodiscovery:true
})


console.log(HerdCacheClient.config);




process.on( 'SIGINT', function() {
  console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
  // some other closing procedures go here
  process.exit( );
})


