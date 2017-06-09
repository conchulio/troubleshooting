var fs = require('fs');
var util = require('util');
var static = require('node-static');
var http = require('http');
var os = require('os');
var file = new(static.Server)();
var port = 43234;
var server = http.createServer();

server.on('request', function(req, res) {
  file.serve(req, res);
});
server.listen(port, function () { console.log('Listening on ' + server.address().port) });
