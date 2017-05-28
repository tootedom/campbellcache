function Timer() {
    this.start = process.hrtime();
    return this;
}

Timer.prototype.toString = function() {
    return this.inspect();
}

Timer.prototype.inspect = function () {
    var end = process.hrtime(this.start);
    var taken = (end[0]*1000)+Math.round(end[1]/1000000);
    return taken;
}

module.exports = Timer;
