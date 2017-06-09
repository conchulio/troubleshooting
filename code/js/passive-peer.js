var browserName = null;
if (navigator.userAgent.match(/Firefox/) && !navigator.userAgent.match(/Chrome/))
  browserName = 'firefox';
else if (navigator.userAgent.match(/Chrome/))
  browserName = 'chrome';

var RTCPeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
var RTCDataConnection = window.mozRTCDataConnection || window.webkitRTCDataConnection;
var SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;

var millisecondsToTransmit = 5000;
var pingInterval = 200;
var timesPerMeasurement = 2;
var timeoutValue = millisecondsToTransmit*2;
var port = 43234;

var webrtcPing = 'webrtc_ping';
var ajaxPing = 'ajax_ping';
var websocketPing = 'websocket_ping';
var udpPing = 'udp_ping';

// var serverName = 'observer';
// var remoteServerName = serverName+':43234';

var isBoss = false;
// var likelyWiFiRouterIpAddress = null;
// var likelyWiFiRouterIpAddress = '172.16.0.1';
var dcPeer = null;
var dcRemote = null;
var remoteSocket = null;
var remotePingSocket = null;

var startTimes = {};
var startTimers = {};
var batches = {};

// var nameToIpAddress = {
//   'imachine': '172.16.0.107',
//   'lenovolinux': '172.16.0.173',
//   'observer': '172.16.0.186',
// }

var manifest = {
  'description' : 'Start some random tools',
  'api' : [
    'socket.udp.*',
  ],
  'destinations' : []
}

var fathomUdpSid = null;

// if (browserName==='firefox') {
//   setTimeout(function() {
//     fathom.init(function(res) {
//       console.log("Initialization suceeded");
//       if (res.error)
//         throw "init failed: " + JSON.stringify(res.error);
//       fathom.socket.udp.open(function(sid) {
//         if (res.error)
//           throw "opening socket failed: " + JSON.stringify(res.error);
//         console.log("Yeah, opened socket!");
//         fathomUdpSid = sid;
//         function receiveUdpData() {
//           // console.log("before receiving");
//           fathom.socket.udp.recv(function(res) {
//           // fathom.socket.udp.read(function(res) {
//             var currentTime = performance.now();
//             console.log("Yeah received something:", res);
//             receiveUdpData();
//             if (res.error && !res.timeout)
//               throw "Receiving failed: " + JSON.stringify(res.error);
//             if (typeof(res.data)!=='undefined') {
//               var msg = JSON.parse(res.data);
//               // console.log('recv:', udpPing+'-'+msg['destination']+'-'+msg['batchNumber']+'-'+msg['seqNum']);
//               msg = processMessage(msg, currentTime, udpPing, msg['destination']);
//               var s = msg['seqNum'];
//               if (!batches[udpPing+'-'+msg['destination']+'-'+msg['batchNumber']][s]) {
//                 batches[udpPing+'-'+msg['destination']+'-'+msg['batchNumber']][s] = msg;
//                 // var messages = res.data.split('}{').map(function(item) {return '{'+item+'}';});
//                 // messages.forEach(function(msg) {
//                 //   var msg = JSON.parse(msg);
//                 //   msg = processMessage(msg, currentTime, udpPing, msg['destination']);
//                 //   var s = msg['seqNum'];
//                 //   batches[udpPing+'-'+msg['destination']+'-'+msg['batchNumber']][s] = msg;
//                 // });
//               }
//             }
//           }, sid, true, 5000, 0);
//         }
//         receiveUdpData();
//       });
//     }, manifest);
//   }, 0);
// }

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

// Code to connect to peer
(function() {
  var pc = null;
  var dc = null;

  // var room = 'ping_room_'+browserName;
  var room = 'ping_room';

  var socket = io({transports: ['websocket']});

  if (room !== '') {
    console.log('Joining room ' + room);
    socket.emit('create or join', room);
  }

  socket.on('full', function(room) {
    console.log('Room ' + room + ' is full');
  });

  socket.on('created', function(room) {
    console.log('Room ' + room + ' is empty');
  });

  socket.on('joined', function(room) {
    console.log('Made request to join room ' + room);
  });

  socket.on('start initiate', function(room) {
    console.log('Got start initiate');
    isBoss = true;
    start();
  });

  socket.on('log', function(array) {
    console.log.apply(console, array);
  });

  function start() {
    pc = new RTCPeerConnection(configuration);

    // send any ice candidates to the other peer
    pc.onicecandidate = function (event) {
      if (event.candidate && event.candidate.candidate.match(/typ host/)) {
        var localIpAddress = event.candidate.candidate.match(/\d+\.\d+\.\d+\.\d+/)[0];
        if (localIpAddress.match(/^(?:192\.168|172|10)\./)) {
          // likelyWiFiRouterIpAddress = localIpAddress.slice(0, localIpAddress.lastIndexOf('.'))+'.1';
          // console.log('got likelyWiFiRouterAddress',likelyWiFiRouterIpAddress);
        }
      }
      socket.emit('message', JSON.stringify({ "candidate": event.candidate }));
    };

    dc = pc.createDataChannel("ping_channel", dataChannelOptions);
    dcPeer = dc;

    dc.onopen = dataChannelStateChanged;
    pc.ondatachannel = receiveDataChannel;
    dc.onclose = close;
    pc.onclose = close;

    if (isBoss) {
      pc.createOffer(function(desc) {
        pc.setLocalDescription(desc);
        // console.log('sending', JSON.stringify({ "sdp": desc }));
        socket.emit('message', JSON.stringify({ "sdp": desc }));
      }, error);
    }
  }

  socket.on('message', function(event) {
    console.log("Peer connection got message", event);
    if (!pc)
      start(false);

    var signal = JSON.parse(event);
    if (signal.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(signal.sdp), function() {
        if (!isBoss) {
          pc.createAnswer(function(desc) {
            pc.setLocalDescription(desc);
            // console.log('sending', JSON.stringify({ "sdp": desc }));
            socket.emit('message', JSON.stringify({ "sdp": desc }));
          }, error);
        }
      }, error);
    } else if (signal.candidate && signal.candidate !== null) {
      pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } 
  });
  function receiveDataChannel(event) {
    dc.channel = event.channel;
    dc.channel.onmessage = function(event) {
      dc.send(event.data);
    };
  }
  function dataChannelStateChanged() {
    console.log('dc state changed', dc.readyState);
    if (dc.readyState === 'open') {
      console.log("Yeah, opened data channel!");
    }
  }
})();

function isEmpty(obj) {
  return Object.keys(obj).length === 0 && JSON.stringify(obj) === JSON.stringify({});
}
function error(err) {
  throw err;
}
function success(res) {
  console.log("Success", res)
}
function close() {
  console.log("close");
};