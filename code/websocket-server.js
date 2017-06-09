var http = require('http');
var static = require('node-static');
var file = new(static.Server)();
var port = 43234;

var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(port);

// var WebSocketServer = require('ws').Server;
// var wss = new WebSocketServer({ server: app });

// wss.on('connection', function connection(ws) {
//   console.log('New connection!');
//   ws.on('message', function incoming(message) {
//     ws.send(message);
//   });
// });

var io = require('socket.io').listen(app);
io.set('transports', ['websocket']);
var localSocket = null;

// Code to connect
io.on('connection', function(socket) {
  console.log('A user connected');

  // socket.on('websocketPing', function(message) {
  //   socket.emit('websocketPong', message);
  //   // console.log('Got ping message');
  // });

  socket.on('message', function(message) {
    console.log('Got message:', message);
    var amendedMessage = JSON.parse(message);
    amendedMessage.id = socket.id;
    if (localSocket) {
      localSocket.emit('message', JSON.stringify(amendedMessage));
    } else {
      console.log("Remote end not connected");
    }
  });

  socket.on('localSocketConnect', function(message) {
    console.log('got localSocketConnect');
    localSocket = socket;
  });

  socket.on('messageFromLocalSocket', function(message) {
    console.log('Got message from local socket:', message);
    var correctSocket = io.sockets.connected[JSON.parse(message).id];
    // console.log(correctSocket);
    correctSocket.emit('message', message);
  });
});
