util = require('./util');
setRandomArray = util.setRandomArray;
ab2str = util.ab2str;
str2ab = util.str2ab;
clone = util.clone;
calculateTValueForCorrelation = util.calculateTValueForCorrelation;

var configuration = {
  'iceServers': [{
    'urls': ['stun:stun.l.google.com:19302']
  }]
};
var dataChannelOptions = {
  maxRetransmits: 0,
  ordered: false
};

var platform = require('platform');

var $ = require("jquery");
// window.$ = $;
// window.jQuery = $;

var webrtcPing = 'webrtc_ping';
var ajaxPing = 'ajax_ping';


var totalDuration = 2500;
// var routerMaximumPerSecond = 70;
// routerTimes = (totalDuration/1000)*routerMaximumPerSecond; // More than this isn't possible because then it's considered a SYN flood.
var routerTimes = 151;
var peerTimes = 501; // More than this makes the other measurements unreliable
var serverTimes = 151;
var offsetBetweenPeers = 500;

var measurementsToDo = [
  {index: 0, method:'ajax_ping,POST', destination:'router', times:routerTimes, interval:totalDuration/routerTimes},
  {index: 1, method:'webrtc_ping', destination:'other_machine', times:peerTimes, interval:totalDuration/peerTimes},
  {index: 2, method:'ajax_ping,POST', destination:'server', times:serverTimes, interval:totalDuration/serverTimes},
  {index: 3, method:'ajax_ping,POST', destination:'self', times:routerTimes, interval:totalDuration/routerTimes},
];



var Measurement = function(isWorker) {
  this.isWorker = isWorker || false;

  console.log('Instantiated new Measurement object, isWorker is', this.isWorker);

  this.startTimes = {};
  this.startTimers = {};
  this.batches = {};

  this.results = [];
  this.runningMeasurement = null;
  this.experimentStartedAt = null;

  this.resultsToTransmit = {};

  var that = this;

  if (!isWorker) {
    this.scheduledMeasurements = [];
    this.batchNumber = 0;
    this.pcPeerHash = {};
    this.dcPeerHash = {};
    this.pcLocal = null;
    this.dcLocal = null;
    window.pcPeerHash = this.pcPeerHash;
    window.dcPeerHash = this.dcPeerHash;
    RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;

    $.ajax({url:'https://mlab-ns.appspot.com/ndt'})
    .done(function(response){
      console.log('Closest mlab server', response.fqdn);
      that.mlabServer = response.fqdn;
    }).fail(function(response) {
      console.error('Getting closest MLab server failed');
    });

    this.workers = {};

    this.gui = require('./gui');
    this.ss = require('simple-statistics');
    this.tProb = require('./statistics-distributions');
    Measurement.mannwhitneyuTest = require('./mannwhitneyu');

    // var RTCIceCandidate = window.RTCIceCandidate;
    // var SessionDescription = window.RTCSessionDescription;

    this.establishSocketConnection();

    $(function() {
      var periodicMeasurementIntervalId = null;
      window.periodicMeasurementIntervalId = periodicMeasurementIntervalId;
      $('.btn-troubleshoot').click(function() {that.performMeasurement();});
      $('.btn-measurement-interval-clear').click(function() {
        if (periodicMeasurementIntervalId) {
          console.log("cleared timeout");
          clearInterval(periodicMeasurementIntervalId);
        }
      });
      $('.btn-measurement-interval').click(function() {
        if (periodicMeasurementIntervalId)
          clearInterval(periodicMeasurementIntervalId);
        var interval = Number($('.measurement-interval').val());
        var automaticMeasurement = function() {
          console.log("Performing automatic measurement");
          performMeasurement();
        }
        periodicMeasurementIntervalId = setInterval(automaticMeasurement, interval);
        automaticMeasurement();
      });
    });
    for (var i = 0; i < measurementsToDo.length; i++) {
      if (measurementsToDo[i].method.match(/ajax/)) {
        console.log("Creating new worker for", measurementsToDo[i].destination);
        var ajaxPingWorker = new Worker("js/ajax-ping-worker-dist.js");
        that.workers[measurementsToDo[i].destination] = ajaxPingWorker;
      }
    }
  }
}

// Code to connect to peer
Measurement.prototype.establishPeerConnection = function(peerName, isBoss, message) {
  var that = this;
  console.log("Yeah, peer connection establishment called for", peerName,"and isBoss is",isBoss,"!");
  // var pc = pcPeer;
  // var dc = dcPeer;

  var pc = null;
  var dc = null;

  function start(isBoss) {
    pc = new RTCPeerConnection(configuration);
    pc.os = message.os;
    pc.browser = message.browser;
    if (peerName===that.ownId && isBoss) {
      that.pcLocal = pc;
    } else {
      that.pcPeerHash[peerName] = pc;
    }

    // send any ice candidates to the other peer
    pc.onicecandidate = function (event) {
      // console.log("ice candidate", event);
      if (peerName===that.ownId && isBoss && event.candidate && event.candidate.candidate.match(/typ host/)) {
        var localIpAddress = event.candidate.candidate.match(/\d+\.\d+\.\d+\.\d+/)[0];
        // FIXME This test is very superficial and only works for IPv4
        if (localIpAddress.match(/^(?:192\.168|172|10)\./)) {
          that.likelyWiFiRouterIpAddress = localIpAddress.slice(0, localIpAddress.lastIndexOf('.'))+'.1';
          console.log('got likelyWiFiRouterIpAddress', that.likelyWiFiRouterIpAddress);
        }
      }
      that.socket.send(JSON.stringify({ "recipientSocketId": peerName, isBoss: isBoss, "candidate": event.candidate }));
    };

    pc.peerName = peerName;

    dc = pc.createDataChannel("ping_channel", dataChannelOptions);
    dc.binaryType = "arraybuffer";
    // dc.bufferedAmountLowThreshold = bufferedAmountLowThreshold; // 16 KiB - 1 B
    dc.peerName = peerName;
    if (peerName===that.ownId && isBoss) {
      that.dcLocal = dc;
    } else {
      that.dcPeerHash[peerName] = dc;
    }

    pc.oniceconnectionstatechange = function() {
      console.log("peer",this.peerName,"iceConnectionState:",pc.iceConnectionState);
      if(pc.iceConnectionState === 'disconnected') {
        // pc.close();
        // dc.close();
        that.updateNodes();
      } else if ((pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') && pc.previousIceConnectionState && pc.previousIceConnectionState==='disconnected') {
        that.updateNodes();
      } else if (pc.iceConnectionState === 'failed') {
        pc.close();
        dc.close();
      }
      pc.previousIceConnectionState = pc.iceConnectionState;
    }

    dc.onopen = dataChannelStateChanged;
    pc.ondatachannel = receiveDataChannel;
    dc.onclose = function() {closeCleanup.call(this, that)};
    pc.onclose = function() {closeCleanup.call(this, that)};

    if (isBoss) {
      pc.createOffer(function(desc) {
        pc.setLocalDescription(desc);
        // console.log('sending sdp', JSON.stringify({ "sdp": desc }));
        that.socket.send(JSON.stringify({ os: Measurement.normalizeOs(platform.os.family), browser: platform.name, recipientSocketId: peerName, isBoss: isBoss, "sdp": desc }));
      }, function (err) {throw err;});
    } else {
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), function() {
        pc.createAnswer(function(desc) {
          pc.setLocalDescription(desc);
          // console.log('sending', JSON.stringify({ "sdp": desc }));
          that.socket.send(JSON.stringify({ os: Measurement.normalizeOs(platform.os.family), browser: platform.name, sdp: desc, isBoss: isBoss, recipientSocketId: message.senderSocketId }));
        }, function (err) {throw err;});
      }, function (err) {throw err;});
    }
  }
  start(isBoss);

  function receiveDataChannel(event) {
    dc.channel = event.channel;
    dc.channel.binaryType = 'arraybuffer';
    dc.channel.onmessage = function(event) {that.receiveMsg(event)};
  }
  function dataChannelStateChanged() {
    console.log('dc state changed', dc.readyState);
    if (dc.readyState === 'open') {
      console.log("Yeah, opened peer data channel!");
      if (peerName!==that.ownId) {
        that.updateNodes();
      }
    }
  }
}

Measurement.prototype.establishSocketConnection = function() {
  var that = this;

  this.socket = new WebSocket("ws://"+location.host+"/peer");

  this.socket.onmessage = function(event) {
    var message = JSON.parse(event.data);
    console.log("received WebSocket message", message);
    if (typeof(message.senderSocketId) === 'number') {
      if (message.senderSocketId===that.ownId && typeof(message.isBoss)!=='undefined' && !message.isBoss) {
        var pc = that.pcLocal;
        var dc = that.dcLocal;
      } else {
        var pc = that.pcPeerHash[message.senderSocketId];
        var dc = that.dcPeerHash[message.senderSocketId];
      }
    }
    // console.log('pc', pc, 'message.senderSocketId', message.senderSocketId);
    // if (message.type==='final-sdp') {
    //   console.log("Yeah, got final sdp", message.data);
    // } else
    if (message.type==="startWebRTC") {
      var peers = message.connectTo;
      console.log("Start establishing WebRTC connection to", peers);
      // var currentPeer = peers[0];
      // console.log(peers);
      // console.log(typeof(peers));
      peers.forEach(function(currentPeer) {
        that.establishPeerConnection(currentPeer, true);
      });
    } else if (message.type==='performMeasurement') {
      if (message.destination===that.ownId) {
        // Means we should measure to ourselves
        console.log("WebRTC ping to myself", that.ownId);
        // message.times = ((message.times-1)/10)+1;
        // message.interval = message.totalDuration/message.times;
        return;
      }
      that.measurement(message);
    } else if (message.type==='measurementResults') {
      // console.log("measurement results message", message);
      // item[resultKey].median = result.map(function(value) {return value.difference}).getMedian();
      that.results[message.index] = that.results[message.index] || {};
      message.data = message.data.filter(function(value) {return value && value.difference > 0;})
      dataWithoutLostPackets = message.data.map(function(value) {return value.difference});
      // console.log('dataWithoutLostPackets.length', dataWithoutLostPackets.length);
      if (dataWithoutLostPackets.length===0) {
        that.gui.setMeasurementRunning(false);
        Measurement.measurementError("Measurement failed, got empty measurerements. Maybe one device got disconnected?");
        return;
      }
      pc.os = message.os;
      pc.browser = message.browser;
      message.median = dataWithoutLostPackets.getMedian();
      message.mean = dataWithoutLostPackets.getMean();
      message.stdev = dataWithoutLostPackets.getStdevPopulation();
      message.min = dataWithoutLostPackets.min();
      message.max = dataWithoutLostPackets.max();
      message.lost = message.times-dataWithoutLostPackets.length;
      if (message.index===1) {
        that.results[message.index][message.senderSocketId] = that.results[message.index][message.senderSocketId] || {};
        that.results[message.index][message.senderSocketId][message.destination] = message;
      } else {
        that.results[message.index][message.senderSocketId] = message;
      }
      that.resultsCounter+=1;
      console.log('resultsCounter', that.resultsCounter, 'results.resultsLength', that.results.resultsLength);
      if (that.resultsCounter===that.results.resultsLength) {
        that.calculateCorrelation();
      }
    } else if (message.type==='ownId') {
      that.ownId = message.ownId;
      window.ownId = that.ownId;
      that.publicIpAddress = message.publicIpAddress.split(':').slice(-1)[0];
      window.publicIpAddress = this.publicIpAddress;
    } else if (message.type==='evaluatedResults') {
      that.results = message.results;
      Measurement.calculateStatistics(message.results, function(statisticsArray) {
        // console.log('statisticsArray', statisticsArray);
        that.gui.setStatistics(statisticsArray);
      });
      that.gui.setResults(that.results);
      that.updateNodes();
      that.gui.setMeasurementRunning(false);
    } else if (message.sdp) {
      if (typeof(message.senderSocketId) === 'number' && !pc) {
        that.establishPeerConnection(message.senderSocketId, false, message);
      } else {
        pc.os = message.os;
        pc.browser = message.browser;
        pc.setRemoteDescription(new RTCSessionDescription(message.sdp), function() {}, function (err) {throw err;});
      }
    } else if (message.candidate && message.candidate !== null) {
      pc.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
  };
}

Measurement.prototype.calculateCorrelation = function() {
  var that = this;
  var allPeers = Object.keys(this.results[0]);
  for (var i = 0; i < allPeers.length; i++) {
    var currentPeer = allPeers[i];
    var serverData = this.results[2][currentPeer].data.map(function(item) {return item.difference;});
    var routerData = this.results[0][currentPeer].data.map(function(item) {return item.difference;});

    var selfData = this.results[3][currentPeer].data.map(function(item) {return item.difference;});
    var ajaxSelfCorrelation = this.ss.sampleCorrelation(selfData, routerData);
    // var ajaxSelfLinearRegression = this.ss.linearRegression(selfData.map(function(item, index) {return [selfData[index], routerData[index]];}));
    var ajaxT = calculateTValueForCorrelation(ajaxSelfCorrelation, routerData.length);
    var ajaxP = this.tProb(1, ajaxT);
    console.log('ajax: peer', currentPeer, 'corr', ajaxSelfCorrelation, 'ajaxT', ajaxT, 'p', ajaxP);//, 'regr', ajaxSelfLinearRegression);
    this.results[0][currentPeer].ajaxSelfCorrelation = ajaxSelfCorrelation;
    this.results[0][currentPeer].ajaxP = ajaxP;

    // // selfData = this.results[1][currentPeer][currentPeer].data.map(function(item) {return item.difference;}).aggregateMean(10);
    // selfData = this.results[1][currentPeer][currentPeer].data.map(function(item) {return item.difference;});
    // var webrtcSelfCorrelation = this.ss.sampleCorrelation(selfData, routerData);
    // // var webrtcSelfLinearRegression = this.ss.linearRegression(selfData.map(function(item, index) {return [selfData[index], routerData[index]];}));
    // var webrtcT = calculateTValueForCorrelation(webrtcSelfCorrelation, routerData.length);
    // var webrtcP = this.tProb(1, webrtcT);
    // console.log('webrtc: peer', currentPeer, 'corr', webrtcSelfCorrelation, 'webrtcT', webrtcT, 'p', webrtcP);//, 'regr', webrtcSelfLinearRegression);
    // this.results[0][currentPeer].webrtcSelfCorrelation = webrtcSelfCorrelation;
  }
  that.transmitResultsToDb();
}

Measurement.prototype.updateNodes = function() {
  var that = this;
  console.log("Update nodes");
  var local = null;
  var peers = [];
  var router = null;
  var internet = null;
  // var peersIncludingMe = Object.keys(pcPeerHash).concat([this.ownId]);
  var peersIncludingMe = Object.keys(that.pcPeerHash).map(function(item) {return Number(item);});
  peersIncludingMe.splice(peersIncludingMe.indexOf(this.ownId), 1);
  peersIncludingMe = peersIncludingMe.concat([this.ownId]);
  console.log('peersIncludingMe', peersIncludingMe);
  for (var i = 0; i < peersIncludingMe.length; i++) {
    var currentPc = that.pcPeerHash[peersIncludingMe[i]];
    if (this.ownId===peersIncludingMe[i]) {
      var type = 'local';
      var ipAddress = currentPc.localDescription.sdp.match(/c=IN IP4.*/)[0].match(/\d+\.\d+\.\d+\.\d+/)[0];
      var rawStuff = {local:{hostname:ipAddress}};
    } else {
      var type = 'peer';
      var ipAddress = currentPc.remoteDescription.sdp.match(/a=candidate:.*udp.*typ host/i)[0].match(/\d+\.\d+\.\d+\.\d+/)[0];
      var rawStuff = {osAndBrowser: (currentPc.browser && currentPc.os) ? currentPc.browser+' on '+currentPc.os : undefined, mdns:{hostname:ipAddress}, iceConnectionState: that.pcPeerHash[peersIncludingMe[i]].iceConnectionState};
    }
    // peerIpAddresses.push(ipAddress);
    var routerBetterThan = null;
    if (that.results && that.results[0] && that.results[0][peersIncludingMe[i]] && that.results[0][peersIncludingMe[i]].betterThan) {
      routerBetterThan = that.results[0][peersIncludingMe[i]].betterThan;
    }
    var selfBetterThan = null;
    if (that.results && that.results[3] && that.results[3][peersIncludingMe[i]] && that.results[3][peersIncludingMe[i]].betterThan) {
      selfBetterThan = that.results[3][peersIncludingMe[i]].betterThan;
    }
    peers.push({type: type, routerBetterThan: routerBetterThan, selfBetterThan: selfBetterThan, ipv4: ipAddress, reachable: true, raw:rawStuff});
  }
  router = {type: 'gw', ipv4: this.likelyWiFiRouterIpAddress, reachable: true, raw:{mdns:{hostname:this.likelyWiFiRouterIpAddress}}};
  internet = {type: 'internet', ipv4: this.publicIpAddress, reachable: true, raw:{internet:{ip: this.publicIpAddress}}};
  // local = {type: 'local', ipv4: localIpAddress, reachable: true, raw:{local:{hostname:localIpAddress}}};
  var allNodesToDisplay = [router, internet].concat(peers);
  // console.log('allNodesToDisplay', allNodesToDisplay);
  // console.log('allNodesToDisplay', JSON.stringify(allNodesToDisplay));
  that.gui.setNodes(allNodesToDisplay);
}

Measurement.prototype.webrtcPingFunction = function(batchNumber, seqNum, destination, thing, timeout, times, offsetToTransmitResults) {
  var that = this;
  var dc = this.dcPeerHash[destination];
  var toSend = JSON.stringify({'senderSocketId': this.ownId, 'destination':destination, 'text':'ping', 'seqNum': seqNum, 'batchNumber': batchNumber});
  var toSendBuffer = str2ab(toSend);
  var sendBuffer = new Uint16Array(toSend.length+randomArray.length/2);
  sendBuffer.set(new Uint16Array(toSendBuffer));
  sendBuffer.set(new Uint16Array(randomArray.buffer), toSend.length);
  this.startTimes[thing+'-'+destination+'-'+batchNumber+'-'+seqNum] = performance.now();
  dc.send(sendBuffer);
  this.startTimers[thing+'-'+destination+'-'+batchNumber+'-'+seqNum] = setTimeout(function(batchNumber, seqNum) {
    console.error("Timeout for webrtc ping to destination", destination, "with batchNumber:",batchNumber,"seqNum:",seqNum);
    delete that.startTimes[thing+'-'+destination+'-'+batchNumber+'-'+seqNum];
    delete that.startTimers[thing+'-'+destination+'-'+batchNumber+'-'+seqNum];
  }, timeout, batchNumber, seqNum);
}

Measurement.prototype.ajaxPingFunction = function(batchNumber, seqNum, destination, thing, timeout, times, offsetToTransmitResults) {
  var that = this;
  var request = new XMLHttpRequest();
  // console.log('destination', destination);
  var specificTarget = null;
  switch (destination) {
    case 'server':
      specificTarget = that.mlabServer;
      break;
    case 'router':
      specificTarget = that.likelyWiFiRouterIpAddress;
      break;
    case 'self':
      specificTarget = 'localhost';
      break;
  }
  // console.log(specificTarget);
  request.onreadystatechange = function () {
    var currentTime = performance.now();
    if (this.readyState===2 || this.readyState===3 || this.readyState===4) {
      var readyStateToName = ['unsent', 'opened', 'headers_received', 'loading', 'done'];
      var difference = currentTime-that.startTimes[thing+'-'+destination+'-'+batchNumber+'-'+seqNum];
      // console.log('readyState',readyStateToName[this.readyState] ,'rtt',difference);
      if (!that.batches[thing+'-'+destination+'-'+batchNumber][seqNum]) {
        that.batches[thing+'-'+destination+'-'+batchNumber][seqNum] = {'seqNum':seqNum, 'batchNumber':batchNumber, 'difference':difference, 'startTime':inaccurateDate};
        clearTimeout(that.startTimers[thing+'-'+destination+'-'+batchNumber+'-'+seqNum]);
        delete that.startTimes[thing+'-'+destination+'-'+batchNumber+'-'+seqNum];
        delete that.startTimers[thing+'-'+destination+'-'+batchNumber+'-'+seqNum];
      }
    }
  };
  var inaccurateDate = Date.now();
  request.open(thing.split(',')[1], 'http://'+specificTarget+':1337/?xyz='+inaccurateDate, true);
  this.startTimes[thing+'-'+destination+'-'+batchNumber+'-'+seqNum] = performance.now();
  request.send(inaccurateDate);

  var timeoutFunction = function(batchNumber, seqNum) {
    console.error("Timeout for ajax ping to destination", destination, "with batchNumber:",batchNumber,"seqNum:",seqNum);
    delete that.startTimes[thing+'-'+destination+'-'+batchNumber+'-'+seqNum];
    delete that.startTimers[thing+'-'+destination+'-'+batchNumber+'-'+seqNum];
  };

  this.startTimers[thing+'-'+destination+'-'+batchNumber+'-'+seqNum] = setTimeout(timeoutFunction, timeout, batchNumber, seqNum);
}

Measurement.measurementError = function(errorMessage) {
  alert('Error: '+errorMessage);
}

Measurement.calculateStatistics = function(localResults, callback) {
  var numOfDifferentTargets = localResults.length;
  var counter = 0;
  var statisticsArray = localResults.map(function(item) {return {};});
  // console.log("localResults", localResults);
  localResults.forEach(function(item, index) {
    // console.log('item, index', item, index);
    var cleanedItem = clone(item);
    delete cleanedItem['stats'];
    if (index!==1) {
      Measurement.calculateStatisticsItem(cleanedItem, function(resultsHash) {
        statisticsArray[index] = resultsHash;
        counter+=1;
        // console.log('index,counter,numOfDifferentTargets',index,counter,numOfDifferentTargets);
        if (counter>=numOfDifferentTargets)
          callback(statisticsArray);
      });
    } else {
      // console.log("JSON.flatten(cleanedItem,2)", JSON.flatten(cleanedItem,2));
      Measurement.calculateStatisticsItem(JSON.flatten(cleanedItem,2), function(resultsHash) {
        statisticsArray[index] = resultsHash;
        counter+=1;
        // console.log('index,counter,numOfDifferentTargets',index,counter,numOfDifferentTargets);
        if (counter>=numOfDifferentTargets)
          callback(statisticsArray);
      });
    }
  });
}

Measurement.calculateStatisticsItem = function(resultsHash, callback) {
  var that = this;
  // console.log('resultsHash', resultsHash);
  var possibilities = Object.keys(resultsHash).length*(Object.keys(resultsHash).length-1)/2;
  var counter = 0;
  var allCombinations = {};
  Object.keys(resultsHash).forEach(function(firstKey) {
    Object.keys(resultsHash).forEach(function(secondKey) {
      if (Number(firstKey) < Number(secondKey)) {
        var xVals = resultsHash[firstKey]['data'].map(function(x) {return x.difference;});
        var yVals = resultsHash[secondKey]['data'].map(function(x) {return x.difference;});

        var uAndP = that.mannwhitneyuTest(xVals, yVals);
        // console.log('resultsHash[firstKey]', resultsHash[firstKey]['data'], 'resultsHash[secondKey]', resultsHash[secondKey]['data'], 'uAndP', uAndP);
        if (!allCombinations[firstKey+'-'+secondKey])
          allCombinations[firstKey+'-'+secondKey] = {};

        allCombinations[firstKey+'-'+secondKey]['p'] = uAndP.p/2;
        allCombinations[firstKey+'-'+secondKey]['U'] = uAndP.U;
        allCombinations[firstKey+'-'+secondKey]['r'] = 1-((2*uAndP.U)/(xVals.length*yVals.length));
        allCombinations[firstKey+'-'+secondKey]['smaller'] = true;
        if (xVals.getMean() >= yVals.getMean()) {
          allCombinations[firstKey+'-'+secondKey]['smaller'] = false;
        }
        // console.log('calculateStatisticsItem','xMean', xVals.getMean(),'yMean', yVals.getMean(),'smaller',allCombinations[firstKey+'-'+secondKey]['smaller']);
        counter+=1;
        // console.log('counter,possibilities',counter,possibilities);
        if (counter>=possibilities) {
          return callback(allCombinations);
        }
      }
    });
  });
}

Measurement.prototype.receiveMsg = function(event) {
  var that = this;
  var currentTime = performance.now();
  if (event.data instanceof ArrayBuffer) {
    var payload = new Uint16Array(event.data);
  } else {
    console.log('Weird type of event.data', event.data);
    return;
  }
  var asString = ab2str(payload.slice(0, payload.length-randomArray.length/2));
  var msg = JSON.parse(asString);
  if (msg['text'] === 'ping') {
    msg['text'] = 'pong';
    payload.set(new Uint16Array(str2ab(JSON.stringify(msg))));
    if (msg['senderSocketId']!==this.ownId) {
      that.dcPeerHash[msg['senderSocketId']].send(payload);
    } else {
      that.dcLocal.send(payload);
    }
  } else if (msg['text'] === 'pong') {
    var s = msg['seqNum'];
    var difference = +(currentTime-this.startTimes[webrtcPing+'-'+msg['destination']+'-'+msg['batchNumber']+'-'+s]).toFixed(3);
    clearTimeout(this.startTimers[webrtcPing+'-'+msg['destination']+'-'+msg['batchNumber']+'-'+s]);
    delete this.startTimes[webrtcPing+'-'+msg['destination']+'-'+msg['batchNumber']+'-'+s];
    delete this.startTimers[webrtcPing+'-'+msg['destination']+'-'+msg['batchNumber']+'-'+s];
    msg['difference'] = difference;
    if (!this.batches[webrtcPing+'-'+msg['destination']+'-'+msg['batchNumber']][s]) {
      this.batches[webrtcPing+'-'+msg['destination']+'-'+msg['batchNumber']][s] = msg;
    }
  }
}

Measurement.prototype.performMeasurement = function() {
  var that = this;
  that.gui.setMeasurementRunning(true);
  that.experimentStartedAt = Date.now();
  console.log("Perform measurement at", new Date(Date.now()));
  that.runningMeasurement = true;
  that.results = [];
  var allPeers = Object.keys(that.pcPeerHash).filter(function(item) {return that.pcPeerHash[item].iceConnectionState==='connected' || that.pcPeerHash[item].iceConnectionState==='completed'}).map(function(item) {return Number(item);});
  allPeers.shuffle();

  that.resultsCounter = 0;
  // For every peer measure to server and router. All peers measure to each other and to themselves.
  var webrtcPeers = allPeers.length-1;
  var allMeasurementsExceptWebRTC = measurementsToDo.length-1;
  that.results.resultsLength = allPeers.length*allMeasurementsExceptWebRTC+allPeers.length*webrtcPeers;
  var numOfMeasurementsWhichEachPeerHasToPerform = allMeasurementsExceptWebRTC + webrtcPeers;

  that.batchNumber += 1;
  measurementsToDo.shuffle();
  measurementsToDo.forEach(function(item) {

    var index = item.index;
    var measurementTask = {
      type:"performMeasurement",
      method:item.method,
      destination:item.destination,
      batchNumber:that.batchNumber,
      index:index,
      times:item.times,
      interval:item.interval,
      recipientSocketId:'all',
      allPeers:allPeers,
      totalDuration:totalDuration,
      numOfMeasurementsWhichEachPeerHasToPerform: numOfMeasurementsWhichEachPeerHasToPerform,
    };
    var whenToSend = 0;
    if (index!==1) {
      setTimeout(function(measurementTask) {that.socket.send(JSON.stringify(measurementTask));}, whenToSend, measurementTask);
    } else {
      measurementTask.payloadLength = 900;
      allPeers.forEach(function(otherSocketId) {
        // console.log('index*interMeasurementDelay', index*interMeasurementDelay);
        setTimeout(function(measurementTask) {
          measurementTask.destination = Number(otherSocketId);
          that.socket.send(JSON.stringify(measurementTask));
        }, whenToSend, measurementTask);
      });
    }
  });
}

Measurement.prototype.transmitResultsToDb = function() {
  // console.log("transmitting results to db", results);
  this.socket.send(JSON.stringify({type:"finishedResults", recipientSocketId:"database", experimentStartedAt:this.experimentStartedAt, resultsLength: this.results.resultsLength, results:this.results}));
}

Measurement.prototype.sendResults = function(thing, destination, batchNumber) {
  if (arguments.length===1) {
    // console.log('send results from Ajax worker', arguments[0]);
    this.socket.send(JSON.stringify(arguments[0]));
    return;
  }
  // console.log('send results not from Ajax worker', thing, destination, batchNumber);
  if (!this.resultsToTransmit[thing+'-'+destination+'-'+batchNumber])
    return;

  // console.log('this.batches', JSON.stringify(this.batches[thing+'-'+destination+'-'+batchNumber]));
  // console.log('resultsToTransmit', JSON.stringify(resultsToTransmit[thing+'-'+destination+'-'+batchNumber]));
  this.resultsToTransmit[thing+'-'+destination+'-'+batchNumber].data = this.batches[thing+'-'+destination+'-'+batchNumber].slice(1);
  this.socket.send(JSON.stringify(this.resultsToTransmit[thing+'-'+destination+'-'+batchNumber]));
  delete this.batches[thing+'-'+destination+'-'+batchNumber];
  delete this.resultsToTransmit[thing+'-'+destination+'-'+batchNumber];
  console.log('thing',thing, 'destination', destination, 'deleted batch',batchNumber);
}

closeCleanup = function(measurement) {
  console.log("closeCleanup", this.peerName);
  delete measurement.pcPeerHash[this.peerName];
  delete measurement.dcPeerHash[this.peerName];
  // Wait a bit to update the graph
  redrawCanvasOnClean = setTimeout(function() {console.log('redraw timeout'); clearTimeout(redrawCanvasOnClean); measurement.updateNodes();}, 0);
}

Measurement.prototype.launchAllMeasurements = function() {
  var timestamp = Date.now();
  console.log("launchAllMeasurements", "this.numOfMeasurementsWhichEachPeerHasToPerform", "this.scheduledMeasurements.length", this.numOfMeasurementsWhichEachPeerHasToPerform, this.scheduledMeasurements.length)
  if (this.numOfMeasurementsWhichEachPeerHasToPerform === this.scheduledMeasurements.length) {
    this.scheduledMeasurements.forEach(function(item) {
      item.call(null, timestamp);
    });
    this.scheduledMeasurements = [];
  }
}

Measurement.prototype.measurement = function(message) {
  var that = this;

  this.numOfMeasurementsWhichEachPeerHasToPerform = message.numOfMeasurementsWhichEachPeerHasToPerform;

  // console.log('measurement: thing', thing);
  var pingFunction = null;
  switch (message.method.split(',')[0]) {
    case ajaxPing:
      console.log("isWorker", that.isWorker);
      if (!that.isWorker) {
        console.log("Recycling old worker");
        var ajaxPingWorker = that.workers[message.destination];
        var beginMeasurement = function(message, timestamp) {
          ajaxPingWorker.postMessage(["beginMeasurement", timestamp]);
        };
        ajaxPingWorker.onmessage = function(event) {
          // console.log("Got results from worker", event);
          var messageType = event.data[0];
          var messagePayload = event.data[1];
          // There's only one message type so no check about it
          that.sendResults(messagePayload);
        }
        ajaxPingWorker.postMessage(["performMeasurement", message, this.ownId, this.likelyWiFiRouterIpAddress, this.mlabServer, message.batchNumber]);
        // ajaxPingWorker.onerror = function(event) {console.log('error', event);};
        that.scheduledMeasurements.push(beginMeasurement.bind(that, message));
        that.launchAllMeasurements();
        // return;
      }
      pingFunction = that.ajaxPingFunction;
      break;
    case webrtcPing:
      pingFunction = that.webrtcPingFunction;
      break;
  }
  var beginMeasurement = function(message, timestamp) {
    console.log('Start measurement to', message.method, message.destination, Date.now());

    var timeoutValue = 1000;

    this.batches[message.method+'-'+message.destination+'-'+message.batchNumber] = [];
    this.batches[message.method+'-'+message.destination+'-'+message.batchNumber].batchNumber = message.batchNumber;

    this.resultsToTransmit[message.method+'-'+message.destination+'-'+message.batchNumber] = {
      os: Measurement.normalizeOs(platform.os.family),
      browser: platform.name,
      method:message.method,
      times:message.times-1,
      destination:message.destination,
      index:message.index,
      batchNumber:message.batchNumber,
      type:"measurementResults",
      recipientSocketId:message.senderSocketId
    };
    // console.log('message', message);
    if (typeof(message.destination)==='number') {
      setRandomArray(message.payloadLength);
    }

    var offset = message.allPeers.indexOf(this.ownId)===0 ? 0 : (message.totalDuration+offsetBetweenPeers)*message.allPeers.indexOf(this.ownId);
    // So that the other machine is not disturbed by having to process the results

    var offsetToTransmitResults = (message.totalDuration+offsetBetweenPeers)*message.allPeers.length+offsetBetweenPeers;

    var ping = function(seqNum) {
      pingFunction.call(that, message.batchNumber, seqNum, message.destination, message.method, timeoutValue, message.times, offsetToTransmitResults);
      if (seqNum === message.times-1) {
        console.log("Ending measurement at", new Date(Date.now()));
      }
    };

    var offsetDate = Date.now();
    offset += (50-(offsetDate-timestamp));
    console.log('offset', offset, 'starting experiment at', new Date(offsetDate+offset));

    for (var i=0; i<message.times; i++) {
      setTimeout(ping, offset+i*message.interval+Math.random()*message.interval, i);
    }
    console.log('offsetToTransmitResults, thing, destination, batchNumber', offsetToTransmitResults, message.method, message.destination, message.batchNumber);
    setTimeout(function(method, destination, batchNumber) {that.sendResults(method, destination, batchNumber)}, offsetToTransmitResults, message.method, message.destination, message.batchNumber);
  };
  if (pingFunction === that.ajaxPingFunction) {
    this.beginAjaxMeasurement = beginMeasurement.bind(that, message);
    // beginMeasurement.call(that, message);
  } else {
    this.scheduledMeasurements.push(beginMeasurement.bind(that, message));
    this.launchAllMeasurements();
  }
}

Measurement.normalizeOs = function(os) {
  if (os.match(/Ubuntu/)) {
    return 'Linux';
  }
  return os;
}

module.exports = {
  Measurement: Measurement,
};
