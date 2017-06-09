var exec = require('child_process').exec;
var fs = require('fs');
var static = require('node-static');
var http = require('http');
var os = require('os');
var file = new(static.Server)();
var Sequelize = require("sequelize");
var port = 43234;
var server = http.createServer();
var WebSocketServer = require('ws').Server
var path = require('path');
var rio = require('rio');
// var sendHeartbeats = require('ws-heartbeats');
rio.enableDebug(true);

var interfaces = os.networkInterfaces();
var myIpv4Address = [].concat.apply([], Object.keys(interfaces).map(function(v) { return interfaces[v]; })).filter(function(item) {return !item.internal && item.family==='IPv4'})[0].address;

var db = require('./models/index');
var sequelize = db.sequelize;
var models = require('./models');
var Result = models.Result;

var targets = ['router', 'peer', 'server', 'self'];

// var wsss = new WebSocketServer({ server: server, path: '/server' });
//
// wsss.on('connection', function connection(ws) {
//   // var location = url.parse(ws.upgradeReq.url, true);
//   console.log("local socket got connection!"
// );
//
//   webRTCServer = ws;
//   ws.on('message', function incoming(message) {
//     console.log("local socket got message", message);
//     var parsed = JSON.parse(message);
//     var recipient = idsToSockets[parsed.recipientSocketId];
//     parsed.senderSocketId = 'server';
//     console.log("local socket sends message", parsed, "for recipient", parsed.recipientSocketId);
//     try {
//       recipient.send(JSON.stringify(parsed));
//     } catch (e) {
//       console.log("Local socket: Recipient socket probably disappeared");
//     }
//   });
// });

var webRTCServer = null;
var idsToSockets = {};

var wssp = new WebSocketServer({ server: server, path: '/peer' });

var webSocketClientCounter = 0;

function removeDeadSocket(id) {
  if (idsToSockets[id]) {
    idsToSockets[id].close();
    delete idsToSockets[id];
  }
}

wssp.on('connection', function(ws) {
  // var location = url.parse(ws.upgradeReq.url, true);
  console.log("peer socket got connection!");
  // console.log("socket",Object.keys(ws));
  // sendHeartbeats(ws, {heartbeatTimeout: 1500, heartbeatInterval: 500});

  var existingNodes = Object.keys(idsToSockets).map(function(item) {return Number(item)});
  webSocketClientCounter += 1;
  ws.id = webSocketClientCounter;
  var address = ws.upgradeReq.connection.remoteAddress.split(':');
  address = address[address.length-1];
  ws.send(JSON.stringify({type:'ownId',ownId:ws.id,publicIpAddress:address}));
  exec("traceroute -w 1 "+address, function(error, stdout, stderr) {
    // console.log('stdout', stdout, typeof(ws.upgradeReq.connection.remoteAddress), ws.upgradeReq.connection.remoteAddress);
    var lines = stdout.split("\n");
    lines.splice(-1,1);
    if (stdout.split("\n").length<=1) {
      var accessIp = myIpv4Address;
    } else {
      var accessIp = lines[lines.length-2].match(/\d+\.\d+\.\d+\.\d+/)[0];
    }
    ws.send(JSON.stringify({type:'accessIp',accessIp:accessIp}));
  });
  idsToSockets[webSocketClientCounter] = ws;
  console.log("idsToSockets.length", Object.keys(idsToSockets).length);

  // if (existingNodes.length > 0) {
    // var establishPeerConnectionMessage = {type:"startWebRTC", connectTo:existingNodes};
    var establishPeerConnectionMessage = {type:"startWebRTC", connectTo:existingNodes.concat([webSocketClientCounter])};
    // console.log("sending", establishPeerConnectionMessage);
    ws.send(JSON.stringify(establishPeerConnectionMessage));
  // }

  ws.on('message', function(message) {
    // console.log("peer socket got message", message);
    var parsed = JSON.parse(message);
    parsed.senderSocketId = ws.id;
    if (typeof(parsed.recipientSocketId) === 'number') {
      var recipient = idsToSockets[parsed.recipientSocketId];
    } else if (parsed.recipientSocketId === 'server') {
      // console.log("recipient should be server", parsed.recipientSocketId);
      var recipient = webRTCServer;
    } else if (parsed.recipientSocketId === 'database') {
      // console.log("Got results to save in the database", parsed);
      calculateServerSideStatistics(parsed, saveRecords);
      return;
    } else if (parsed.recipientSocketId === 'all') {
      // console.log("Got broadcast message", parsed);
      Object.keys(idsToSockets).forEach(function(socketId) {
        socketId = Number(socketId);
        var recipient = idsToSockets[socketId];
        parsed.recipientSocketId = socketId;
        // console.log("peer socket sends message", parsed, "for recipient", socketId);
        try {
          recipient.send(JSON.stringify(parsed));
        } catch (e) {
          console.log("Client socket: Recipient socket probably disappeared");
          removeDeadSocket(ws.id);
        }
      });
      return;
    } else {
      console.error("peer socket got message without recipient!");
      return;
    }
    // console.log("peer socket sends message", parsed, "for recipient", parsed.recipientSocketId);
    try {
      recipient.send(JSON.stringify(parsed));
    } catch (e) {
      console.log("Client socket: Recipient socket probably disappeared");
      removeDeadSocket(ws.id);
    }
  });

  ws.on('close', function() {
    console.log("peer socket closed connection with id", ws.id);
    removeDeadSocket(ws.id);
  });
});

// // Create unfolded table on every startup
// sequelize.query('drop table if exists unfolded').then(function(response) {
//   sequelize.query('select * into unfolded from (select os, unnest(rtt1) as rtt from "browsertest_mapped" where rtt1 is not null and (ssid = \'\') IS NOT FALSE and (bssid = \'\') IS NOT FALSE and array_length(rtt1, 1) > 0) as subq where rtt > 0 ');
// });
// // Create unfolded table on every startup
// sequelize.query('drop table if exists unfolded_self').then(function(response) {
//   sequelize.query('select * into unfolded_self from (select os, unnest(rtt0) as rtt from "browsertest_mapped" where rtt0 is not null and array_length(rtt0, 1) > 0) as subq where rtt > 0 ');
// });

function sendResultBackToClient(parsed) {
  parsed.type = 'evaluatedResults';
  parsed.recipientSocketId = parsed.senderSocketId;
  var socket = idsToSockets[parsed.senderSocketId];
  parsed.senderSocketId = 'database';
  try {
    socket.send(JSON.stringify(parsed));
  } catch (e) {
    console.log("Client socket: Recipient socket probably disappeared");
    removeDeadSocket(ws.id);
  }
}

function platformToFathomMap(os) {
  if (~os.indexOf('OS X')) {
    return 'darwin';
  } else if (os.match(/Linux/)) {
    return 'linux';
  }
}

function predict(parsed, result, self, callback) {
  // var serverData = results[2][currentPeer].data.map(function(item) {return item.difference;});
  var routerData = result.data.map(function(item) {return item.difference;});
  var selfData = self.data.map(function(item) {return item.difference;});
  // var accessData = results[4][currentPeer].data.map(function(item) {return item.difference;});

  // rio.e({
  //   entrypoint: "getClassProbabilities",
  //   // data: [routerData, parsed.os, parsed.browser],
  //   data: [routerData],
  //   callback: callback
  // });

  fs.writeFile(
    "rfiles/router-"+result.os+"-"+result.browser+"-"+parsed.experimentStartedAt+".txt",
    JSON.stringify({routerData: routerData, selfData: selfData}),
    function(err) {
      if(err) {
        console.error("error with writing", err);
      }
      callback(true, "{}");
    }
  );
}

// Should be const but not supported by all JavaScript interpreters
var EPOCH = '2016-07-20 18:00:00+02';

function calculateServerSideStatistics(parsed, callback) {

  // console.log('sendResultBackToClient, parsed', JSON.stringify(parsed));
  var processedCounter = 0;
  var proceed = function() {
    processedCounter+=1;
    if (processedCounter===parsed.resultsLength) {
      callback(parsed);
    }
  }
  var calculateItemStats = function(result, index, peerName) {
    // var target = targets[index];
    // if (index===0) {
    //   sequelize.query('SELECT min(rtt) as min FROM unfolded_self WHERE os = ?',
    //     { replacements: [platformToFathomMap(result.os)], type: sequelize.QueryTypes.SELECT }
    //   ).then(function(response) {
    //     result.minOfFathomData = response[0].min;
    //     console.log('result.minOfFathomData', result.minOfFathomData);
    //     console.log('result.median-parsed.results[3][peerName].median', result.median-parsed.results[3][peerName].median);
    //     var numberToWeigh = result.median-parsed.results[3][peerName].min+result.minOfFathomData;
    //     console.log('number to weigh', numberToWeigh);
    //     return sequelize.query('select percent_rank(?) within group (order by rtt) from unfolded where os = ?',
    //       { replacements: [numberToWeigh, platformToFathomMap(result.os)], type: sequelize.QueryTypes.SELECT });
    //   }).then(function(response) {
    //     // console.log('response var', response);
    //     result.betterThan = 1-response[0].percent_rank;
    //     console.log('platformToFathomMap(result.os))', platformToFathomMap(result.os));
    //     console.log('result.betterThan', result.betterThan);
    //     proceed();
    //   });
    // } else if (index===3) {
    //   sequelize.query('select percent_rank(?) within group (order by rtt) from "Results" where os = ? and browser = ? and target = ?',
    //     { replacements: [result.median, result.os, result.browser, target], type: sequelize.QueryTypes.SELECT }
    //   ).then(function(response) {
    //     result.betterThan = 1-response[0].percent_rank;
    //     proceed();
    //   });
    // } else {
    //   proceed();
    // }
    if (index===0) {
      predict(parsed, result, parsed.results[3][peerName], function(err, prediction) {
        console.log("raw prediction", prediction);
        if (err) {
          console.error("error", err);
        }
        var prediction = JSON.parse(prediction);
        for (var i=0; i<Object.keys(prediction).length; i++) {
          prediction[Object.keys(prediction)[i]] = prediction[Object.keys(prediction)[i]][0]
        }
        console.log("prediction", prediction);
        result.prediction = prediction;
        proceed();
      });
    } else {
      proceed();
    }
  };
  // console.log('sendResultBackToClient', parsed);
  parsed.results.forEach(function(item, index) {
    if (!parsed.results[index]) {
      return;
    }
    if (!parsed.results[index]['stats']) {
      parsed.results[index]['stats'] = {};
    }
    var target = targets[index];
    sequelize.query('SELECT count(*) as count, percentile_cont(0.5) within group (order by rtt) as median, stddev(rtt) AS stdev, var_pop(rtt) AS variance, avg(rtt) AS average, min(rtt), max(rtt) FROM "Results" WHERE target = ? AND date > ?',
      { replacements: [target, EPOCH], type: sequelize.QueryTypes.SELECT }
    ).then(function(response) {
      parsed.results[index]['stats'].totalCount = Number(response[0].count);
      parsed.results[index]['stats'].median = Number(response[0].median);
      parsed.results[index]['stats'].variance = response[0].variance;
      parsed.results[index]['stats'].stdev = response[0].stdev;
      parsed.results[index]['stats'].average = response[0].average;
      parsed.results[index]['stats'].min = response[0].min;
      parsed.results[index]['stats'].max = response[0].max;
      if (index===1) {
        // In case of peer
        Object.keys(item).forEach(function(peerKey) {
          if (peerKey==='stats')
            return;
          // var peer = item[peerKey];
          Object.keys(item[peerKey]).forEach(function(resultKey) {
            calculateItemStats(item[peerKey][resultKey], index);
          });
        });
      } else {
        // All other cases
        Object.keys(item).forEach(function(resultKey) {
          if (resultKey==='stats')
            return;
          calculateItemStats(item[resultKey], index, resultKey);
        });
      }
    });
  });
}

function saveRecords(parsed) {
  var flattened = JSON.flatten(parsed.results);
  var flattenedObjectsLength = Object.keys(flattened).filter(function(item) {return ~item.indexOf('difference');}).length;

  var counter = 0;

  sequelize.query('SELECT nextval(\'"Results_measurementRunId_seq"\'::regclass) AS newId',
      { type: sequelize.QueryTypes.SELECT }
  ).then(function(response) {
    // console.log('subCount', subCount, 'totalCount', totalCount);
    var newId = Number(response[0].newid);
    // console.log('newId', newId);
    parsed.results.forEach(function(item, index) {
      if (!parsed.results[index]) {
        return;
      }
      if (index===1) {
        // In case of peer
        Object.keys(item).forEach(function(peerKey) {
          if (peerKey==='stats')
            return;
          // var peer = item[peerKey];
          Object.keys(item[peerKey]).forEach(function(resultKey) {
            var result = item[peerKey][resultKey]['data'];
            // console.log('result', result);
            result.forEach(function(seq) {
              Result.create({
                rtt: seq.difference,
                target: targets[index],
                date: new Date(parsed.experimentStartedAt),
                socketId: Number(peerKey),
                targetSocketId: Number(resultKey),
                measurementRunId: newId,
                os: parsed.os,
                browser: parsed.browser
              }).then(function(status) {
                counter+=1;
                if (counter===flattenedObjectsLength) {
                  sendResultBackToClient(parsed);
                }
              });
            })
          });
        });
      } else if (index===3) {
        Object.keys(item).forEach(function(resultKey) {
          if (resultKey==='stats')
            return;
          var result = item[resultKey]['data'];
          // console.log('result', result);
          Result.create({
            rtt: item[resultKey].min,
            target: targets[index]+'_min',
            date: new Date(parsed.experimentStartedAt),
            socketId: Number(resultKey),
            measurementRunId: newId,
            os: item[resultKey]['os'],
            browser: item[resultKey]['browser'],
          }).then(function(status) {
            counter+=1;
            if (counter===flattenedObjectsLength+1) {
              sendResultBackToClient(parsed);
            }
          });
          // Result.create({
          //   rtt: item[resultKey].median,
          //   target: targets[index]+'_median',
          //   date: new Date(parsed.experimentStartedAt),
          //   socketId: Number(resultKey),
          //   measurementRunId: newId,
          //   os: item[resultKey]['os'],
          //   browser: item[resultKey]['browser'],
          // }).then(function(status) {
          //   counter+=1;
          //   if (counter===flattenedObjectsLength+1) {
          //     sendResultBackToClient(parsed);
          //   }
          // });
          result.forEach(function(seq) {
            Result.create({
              rtt: seq.difference,
              target: targets[index],
              date: new Date(parsed.experimentStartedAt),
              socketId: Number(resultKey),
              measurementRunId: newId,
              os: item[resultKey]['os'],
              browser: item[resultKey]['browser'],
            }).then(function(status) {
              counter+=1;
              if (counter===flattenedObjectsLength+1) {
                sendResultBackToClient(parsed);
              }
            });
          });
        });
      } else {
        // All other cases
        Object.keys(item).forEach(function(resultKey) {
          if (resultKey==='stats')
            return;
          var result = item[resultKey]['data'];
          // console.log('result', result);
          result.forEach(function(seq) {
            Result.create({
              rtt: seq.difference,
              target: targets[index],
              date: new Date(parsed.experimentStartedAt),
              socketId: Number(resultKey),
              measurementRunId: newId,
              os: item[resultKey]['os'],
              browser: item[resultKey]['browser'],
            }).then(function(status) {
              counter+=1;
              if (counter===flattenedObjectsLength) {
                sendResultBackToClient(parsed);
              }
            });
          });
        });
      }
    });
  });
}

JSON.flatten = function(data) {
  var result = {};
  function recurse (cur, prop) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      for(var i=0, l=cur.length; i<l; i++)
        recurse(cur[i], prop + "[" + i + "]");
      if (l == 0)
        result[prop] = [];
    } else {
      var isEmpty = true;
      for (var p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? prop+"."+p : p);
      }
      if (isEmpty && prop)
        result[prop] = {};
    }
  }
  recurse(data, "");
  return result;
}

function shuffle(a) {
  var j, x, i;
  for (i = a.length; i; i -= 1) {
    j = Math.floor(Math.random() * i);
    x = a[i - 1];
    a[i - 1] = a[j];
    a[j] = x;
  }
}

server.on('request', function(req, res) {
  file.serve(req, res);
});
server.listen(port, function () { console.log('Listening on ' + server.address().port) });
