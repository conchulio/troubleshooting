var browserName = null;
var mtu = null;
if (navigator.userAgent.match(/Firefox/) && !navigator.userAgent.match(/Chrome/)) {
  browserName = 'firefox';
  mtu = 1204;
} else if (navigator.userAgent.match(/Chrome/)) {
  browserName = 'chrome';
  mtu = 1236;
}

var RTCPeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
var RTCDataConnection = window.mozRTCDataConnection || window.webkitRTCDataConnection;
var SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;
                            // Minutes
// var interMeasurementDelay = (1/6)*60*1000
// var isInitiator;

room = 'iperf_room';

var socket = io();

if (room !== '') {
  console.log('Joining room ' + room);
  socket.emit('create or join', room);
}

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('created', function(room) {
  // isInitiator = true;
  console.log('Room ' + room + ' is empty');
});

socket.on('joined', function(room) {
  console.log('Made request to join room ' + room);
  // console.log('I am the passive client');
});

socket.on('start initiate', function(room) {
  console.log('Got start initiate');
  isBoss = true;
  start();
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

var configuration = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
};

var dataChannelOptions = {
  // reliable: false,
  maxRetransmits: 0,
  // maxRetransmitTime: 0,
  ordered: false
};

var pc;
var dc;
var channel;
var isBoss = false;
var numOfNodes = 2;

// run start(true) to initiate a call
function start() {
  console.log("Start called");
  pc = new RTCPeerConnection(configuration);

  // send any ice candidates to the other peer
  pc.onicecandidate = function (evt) {
    // console.log('sending', JSON.stringify({ "candidate": evt.candidate }));
    socket.emit('message', JSON.stringify({ "candidate": evt.candidate }));
  };

  dc = pc.createDataChannel("ping_channel", dataChannelOptions);
  dc.onopen = dataChannelStateChanged;
  pc.ondatachannel = receiveDataChannel;
  dc.onclose = function () {
    console.log("datachannel close");
  };

  if (isBoss) {
    pc.createOffer(gotDescription, error);
  }
}

socket.on('message', function(evt) {
  console.log("Got message", evt);
  // if (typeof(dc) !== 'undefined' && dc.readyState === 'open')
  //   return;
  if (!pc)
    start(false);

  var signal = JSON.parse(evt);
  if (signal.sdp) {
    pc.setRemoteDescription(new RTCSessionDescription(signal.sdp), function() {
      if (!isBoss) {
        pc.createAnswer(gotDescription, error);
      }
    }, error);
  } else if (signal.candidate && signal.candidate !== null) {
    pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
  } else if (signal.candidate === null) {
    if (isBoss) {
      setTimeout(sendPackets, 1000, 1000);
    }
  }
  // else if (signal.candidate === null) {
  //   dc = pc.createDataChannel("ping_channel", dataChannelOptions);
  //   dc.onopen = dataChannelStateChanged;
  //   pc.ondatachannel = receiveDataChannel;
  //   dc.onclose = function () {
  //     console.log("datachannel close");
  //   };
  // }
});
function sendPackets(numMilliseconds) {
  var dataArray = [];
  for (var i=0;i<mtu;i++) {
    dataArray.push(getRandomInt(0, 255));
  }
  var stuffToSend = new Uint32Array(new Uint8Array(dataArray).buffer);
  stuffToSend[0] = numMilliseconds;
  var timeAtBeginning = Date.now();
  var seqNum = 0;
  var bytesSent = 0;
  while (Date.now() < timeAtBeginning+numMilliseconds) {
    stuffToSend[0] = numMilliseconds;
    stuffToSend[1] = seqNum;
    dc.send(stuffToSend);
    // console.log("sent",seqNum);
    bytesSent += mtu;
    seqNum += 1;
  }
  console.log("Finished measurement, sent", seqNum, "packets,",bytesSent,"bytes with a rate of",(bytesSent/(numMilliseconds/1000))/1000000,"Mbits/s");
}
// function sendOnePacket(size) {
//   var dataArray = [];
//   for (var i=0;i<size;i++) {
//     dataArray.push(getRandomInt(0, 255));
//   }
//   var stuffToSend = new Uint32Array(new Uint8Array(dataArray).buffer);
//   dc.send(stuffToSend);
// }
function receiveDataChannel(event) {
  dc.channel = event.channel;
  dc.channel.onmessage = receiveMsg;
}
var interMeasurementDelay = 10*1000;
var pingInterval = 200;
var timesPerMeasurement = 10;
function dataChannelStateChanged() {
  console.log('dc state changed', dc.readyState);
  if (dc.readyState === 'open') {
    console.log("Yeah, opened data channel!");
    // dc.channel.onmessage = receiveMsg;
  }
}

var seqNum = Infinity;
var receivedBytes = 0;
var receivedPackets = 0;
var measurementBeginning = null;
function receiveMsg(evt) {
  var msg = evt.data;
  // Firefox case
  if (msg instanceof Blob) {
    var arrayBuffer;
    var fileReader = new FileReader();
    fileReader.onload = function() {
        arrayBuffer = this.result;
        processMsg(new Uint32Array(arrayBuffer));
    };
    fileReader.readAsArrayBuffer(msg);
  // Chrome case
  } else {
    processMsg(new Uint32Array(msg));
  }
}
function processMsg(msg) {
  var len = msg.length*4;
  var numMilliseconds = msg[0];
  var currentSeqNum = msg[1];
  // Means that a new measurement stream started
  if (currentSeqNum < seqNum) {
    receivedBytes = 0;
    receivedPackets = 0;
    measurementBeginning = Date.now();
    setTimeout(function() {
      measurementBeginning = -1;
      console.log("Finished measurement");
      console.log("Received", receivedPackets, "packets and", receivedBytes, "bytes with a rate of",(receivedBytes/(numMilliseconds/1000))/1000000,"Mbits/s");
    }, numMilliseconds);
  }
  seqNum = currentSeqNum;
  receivedBytes += len;
  receivedPackets += 1;
  // console.log("Received msg number",seqNum,"len",len);
  // console.log("Received msg with length",len);
}
function gotDescription(desc) {
  pc.setLocalDescription(desc);
  // console.log('sending', JSON.stringify({ "sdp": desc }));
  socket.emit('message', JSON.stringify({ "sdp": desc }));
}
function isEmpty(obj) {
  return Object.keys(obj).length === 0 && JSON.stringify(obj) === JSON.stringify({});
}
function error(err) {
  throw err;
}
function success(res) {
  console.log("Success", res)
}
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}