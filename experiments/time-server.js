var static = require('node-static');
var http = require('http');
var now = require("performance-now");
var request = require("request");
var fs = require('fs');
var exec = require('child_process').exec;
var os = require('os');
var file = new(static.Server)();
var ReadWriteLock = require('rwlock');
var interMeasurementDelay = 10*1000;
var timesPerMeasurement = 10;
var pingInterval = 200;
var batchNumber = -1;
var hostnames = ['imachine', 'lenovolinux'];
var numOfMeasurements = 3;
var port = 43234;
var lock = new ReadWriteLock();
var hostname = os.hostname().split('.')[0].toLowerCase();
var isBoss = hostname===bossNode;

var ipAddressToIndex = {
  '::ffff:172.16.0.107':0,
  '::ffff:172.16.0.114':0,
  '::1':0,
  '::ffff:172.16.0.173':1,
  '::ffff:172.16.0.135':1,
  '::ffff:172.16.0.145':1,
  'fd0a:93c1:a90b::c1e':1,
};

if (!Date.prototype.toISOStringWithTimezone) {
  (function() {
    function pad(number, digits, reverse) {
      if (typeof(reverse)==='undefined') {
        var reverse = false;
      }
      if (typeof(digits)==='undefined') {
        var digits = 2;
      }
      var string = ''+number;
      while (string.length < digits) {
        if (!reverse) {
          string = '0'+string;
        } else {
          string = string+'0';
        }
      }
      return string;
    }

    Date.prototype.toISOStringWithTimezone = function() {
      return this.getFullYear() +
        '-' + pad(this.getMonth() + 1) +
        '-' + pad(this.getDate()) +
        'T' + pad(this.getHours()) +
        '-' + pad(this.getMinutes()) +
        '-' + pad(this.getSeconds()) +
        '-' + pad(pad(this.getMilliseconds(), 3), 6, true);
    };
  }());
}
var app = http.createServer(function (req, res) {
  // console.log('req',req);
  // console.log('res',res);
  if (req.method === 'POST' && req.url === '/new_file') {
    var body = [];
    req.on('data', function(chunk) {
      body.push(chunk);
    }).on('end', function() {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('\n');
      body = JSON.parse(Buffer.concat(body).toString());
      console.log('body', body);
      // console.log('getTimezoneOffset', (new Date()).getTimezoneOffset());
      // console.log('stringifiedFirstIndexArray',stringifiedFirstIndexArray);
      // console.log('stringifiedLookupArray',stringifiedLookupArray);
      var firstIndex = body.browser;
      // console.log("req.connection.remoteAddress", req.connection.remoteAddress);
      var secondIndex = ipAddressToIndex[req.connection.remoteAddress];
      // var secondIndex = browserIndexLookup[body.isBoss];
      console.log('firstIndex', firstIndex, 'secondIndex', secondIndex);

      var dateString = new Date(body.time).toISOStringWithTimezone();
      var filename = "../collected_data_time/file_"+dateString+".json";
      console.log('normal data filename', filename);

      lock.writeLock(function(release) {
        fs.readFile(filename, function(err, data) {
          console.log('read data', data);
          var stuffToWrite = JSON.parse(data);
          if (typeof(stuffToWrite[firstIndex])==='undefined') {
            stuffToWrite[firstIndex] = [];
            for (var i=0; i<hostnames.length; i++) {
              stuffToWrite[firstIndex].push({});
            }
          }
          stuffToWrite[firstIndex][secondIndex] = body;
          console.log('stuffToWrite', stuffToWrite);
          fs.writeFile(filename, JSON.stringify(stuffToWrite), function(err) {
            release();
            if (err) {
              return console.log(err);
            }
            console.log("The file was saved!");
          }); 
        });
      });
    });
  } else if (req.method === 'POST' && req.url === '/start_pinging') {
    console.log('Got start_pinging request!');
    var body = [];
    req.on('data', function(chunk) {
      body.push(chunk);
    }).on('end', function() {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('\n');
      var receivedStuff = JSON.parse(Buffer.concat(body).toString());
      startPinging(receivedStuff.currentBatch, receivedStuff.ts);
    });
  } else {
    file.serve(req, res);
  }
}).listen(port);

var io = require('socket.io').listen(app);

if (isBoss) {
  function coordinateMeasurement() {
    setTimeout(coordinateMeasurement, interMeasurementDelay);
    var ts = Date.now();
    batchNumber+=1;
    console.log('Performing measurement', batchNumber);
    io.sockets.emit('performMeasurement', JSON.stringify({'givenBatchNumber':batchNumber, 'ts':ts}));
    var inaccurateTime = Date.now();
    var measuredTime = now();
    var osTimestamp, osTimestampInaccurate;
    function writeStuff() {
      lock.writeLock(function(release) {
        var dateString = new Date(ts).toISOStringWithTimezone();
        var filename = "../collected_data_time/file_"+dateString+".json";
        console.log('own measurements filename', filename);
        fs.readFile(filename, function(err, data) {
          if (err) {
            console.log("Opening file for the first time")
            var stuffToWrite = {};
          } else {
            var stuffToWrite = JSON.parse(data);
          }
          stuffToWrite['measuredByNode'] = {measuredTime:measuredTime,inaccurateTime:inaccurateTime,osTimestamp:osTimestamp,osTimestampInaccurate:osTimestampInaccurate};
          console.log('stuffToWrite', stuffToWrite);
          fs.writeFile(filename, JSON.stringify(stuffToWrite), function(err) {
            release();
            if (err) {
              return console.log(err);
            }
            console.log("The file was saved!");
          }); 
        });
      });
    }
    var finishedMeasurements = 0;
    exec('gdate +%s.%N', function(error, stdout, stderr) {
      osTimestamp = Number(stdout);
      finishedMeasurements+=1;
      if (finishedMeasurements===2)
        writeStuff();
    });
    exec('date +%s', function(error, stdout, stderr) {
      osTimestampInaccurate = Number(stdout);
      finishedMeasurements+=1;
      if (finishedMeasurements===2)
        writeStuff();
    });
  }
  coordinateMeasurement();
}

// // Code to connect
// io.on('connection', function (socket) {

//   console.log('A user connected');

//   socket.on('message', function (message) {
//     console.log('Got message:', message);
//     var correctRoom = null;
//     for (var key in socket.rooms) {
//       if (key.match(/room/)) {
//         correctRoom = key;
//         break;
//       }
//     }
//     console.log("That's the room which the socket is in:", correctRoom, "\n");
//     socket.broadcast.to(correctRoom).emit('message', message);
//   });

//   socket.on('create or join', function(room) {
//     console.log('room', room);
//     var clientsInRoom = io.sockets.adapter.rooms[room] || [];
//     var numClients = clientsInRoom.length;

//     console.log('Room ' + room + ' has ' + numClients + ' client(s)');
//     console.log('Request to create or join room ' + room);

//     if (numClients === 0) {
//       socket.join(room);
//       // socket.emit('created', room);
//       console.log('Joined room, previously empty');
//       // socket.broadcast.to(room).emit('start initiate', room)
//     }
//     // } else if (numClients === 1) {
//     //   socket.emit('join', room);
//     //   socket.join(room)
//     //   socket.emit('joined', room);
//     //   socket.broadcast.to(room).emit('start initiate', room)
//     //   console.log('Joined room, previously one person');
//     // } else { // max two clients
//     //   socket.emit('full', room);
//     //   console.log('Room full');
//     // }
//     // clientsInRoom = io.sockets.adapter.rooms[room] || [];
//     // numClients = io.sockets.adapter.rooms[room].length;
//     // console.log('Room ' + room + ' now has ' + numClients + ' client(s)');

//     // socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
//     // socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room);
//   });
// });

// // var getUsersInRoomNumber = function(roomName, namespace) {
// //   if (!namespace) namespace = '/';
// //   var room = io.nsps[namespace].adapter.rooms[roomName];
// //   if (!room) return null;
// //   return Object.keys(room).length;
// // }