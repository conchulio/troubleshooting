var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.RTCIceCandidate;
var RTCDataConnection = window.RTCDataConnection || window.mozRTCDataConnection || window.webkitRTCDataConnection;
var SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.RTCSessionDescription;
                            // Minutes
// var interMeasurementDelay = (1/6)*60*1000
// var isInitiator;

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

var pcHash = {};
var dcHash = {};

var socket = new WebSocket("ws://"+location.host+"/server");

function start(id) {
  var pc = new RTCPeerConnection(configuration);
  pcHash[id] = pc;

  // send any ice candidates to the other peer
  pc.onicecandidate = function (event) {
    socket.send(JSON.stringify({ "recipientSocketId": id, "candidate": event.candidate }));
  };

  var dc = pc.createDataChannel("ping_channel", dataChannelOptions);
  dcHash[id] = dc;

  pc.oniceconnectionstatechange = function() {
    if(pc.iceConnectionState === 'disconnected') {
      console.log("iceConnectionState === 'disconnected'");
      pc.close();
      dc.close();
    }
  }

  dc.onopen = function() {
    console.log('dc state changed', dc.readyState);
    if (dc.readyState === 'open') {
      // console.log("Yeah finally!");
      // socket.send(JSON.stringify({"recipientSocketId": id, what: 'remoteDescription', type: 'final-sdp', "data": pc.remoteDescription.sdp}));
      console.log("Yeah, opened data channel!");
    }
  };
  pc.ondatachannel = function(event) {
    dc.channel = event.channel;
    dc.channel.onmessage = function(event) {
      var msg = JSON.parse(event.data);
      msg['text'] = 'pong';
      dc.send(JSON.stringify(msg));
    };
  };

  pc.peerName = id;
  pc.onclose = closeCleanup;
  dc.peerName = id;
  dc.onclose = closeCleanup;
}

socket.onmessage = function(event) {
  console.log("Got message", event);

  var message = JSON.parse(event.data);
  var recipientSocketId = message.senderSocketId;
  if (message.sdp) {
    start(recipientSocketId);
    pcHash[recipientSocketId].setRemoteDescription(new RTCSessionDescription(message.sdp), function() {
      pcHash[recipientSocketId].createAnswer(function(desc) {
        pcHash[recipientSocketId].setLocalDescription(desc);
        socket.send(JSON.stringify({"recipientSocketId": recipientSocketId, "sdp": desc}));
      }, function(err) {throw err;});
    }, function(err) {throw err;});
  } else if (message.candidate && message.candidate !== null) {
    pcHash[recipientSocketId].addIceCandidate(new RTCIceCandidate(message.candidate));
  }
};

function closeCleanup() {
  console.log("closeCleanup", this.peerName);
  delete pcPeerHash[this.peerName];
  delete dcPeerHash[this.peerName];
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0 && JSON.stringify(obj) === JSON.stringify({});
}
function success(res) {
  console.log("Success", res)
}

function close() {
  console.log("Closing", this.peerName);
  delete pcHash[this.peerName];
  delete dcHash[this.peerName];
}
