const Rx = require('rxjs');
const net = require('net');


function AutodiscoveryServer(strings) {
    this.num = 0;
    this.requests_ = new Rx.Subject();
    if (strings) {
        if (Array.isArray(strings)) {
            this.responses = strings;
        } else {
            this.responses = [strings];
        }
    } else {
        this.responses = [
                "CONFIG cluster 0 147\r\n" +
                "12\r\n" +
                "myCluster.pc4ldq.0001.use1.cache.amazonaws.com|10.82.235.120|11211 myCluster.pc4ldq.0002.use1.cache.amazonaws.com|10.80.249.27|11211\r\n" +
                "\nEND\r\n",
        ];
    }
    this.responsesSize = this.responses.length;
    this.requests_.subscribe(sendResponse(this));

    console.log(this.responsesSize)

    this.server = net.createServer((socket) => {
        console.log("request");
        this.requests_.next({ sock: socket });
    }).listen(11211, '127.0.0.1', () => {
        console.log(`Server running at http://127.0.0.1:11211/`);
    });

}

AutodiscoveryServer.prototype.close = function() {
    this.server.close();
    this.requests_.complete();
}

function sendResponse(obj) {
    return function(e) {
        var num = obj.num;
        obj.num = obj.num + 1;
        console.log('sending autodiscovery response');
        e.sock.write(obj.responses[num%obj.responsesSize]);
        e.sock.pipe(e.sock);
    }
}

module.exports = AutodiscoveryServer;

