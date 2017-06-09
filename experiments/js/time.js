var browserName = null;
if (navigator.userAgent.match(/Firefox/) && !navigator.userAgent.match(/Chrome/))
  browserName = 'firefox';
else if (navigator.userAgent.match(/Chrome/))
  browserName = 'chrome';
else if (navigator.userAgent.match(/Safari/))
  browserName = 'safari';

var RTCPeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
var RTCDataConnection = window.mozRTCDataConnection || window.webkitRTCDataConnection;
var SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;
                            // Minutes
// var interMeasurementDelay = (1/6)*60*1000
// var isInitiator;

room = 'ping_room_'+browserName;

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

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('performMeasurement', function(data) {
  // measurement(parsedData.givenBatchNumber, parsedData.ts);
  var inaccurateTime = Date.now();
  var measuredTime = performance.timing.navigationStart+performance.now();
  var parsedData = JSON.parse(data);
  // console.log('parsedData', parsedData);
  console.log('posting data');
  // console.log('batches', JSON.stringify(batches));
  var stuffToSend = {time:parsedData.ts,browser:browserName,inaccurateTime:inaccurateTime,measuredTime:measuredTime};
  // console.log('stuffToSend', stuffToSend);
  $.ajax({
    type: "POST",
    url: '/new_file',
    data: JSON.stringify(stuffToSend),
    contentType: "application/json"
  }).done(function(res) {
    console.log("done", res);
  }).fail(function(res) {
    console.log("fail", res);
  }).always(function(res) {
    console.log("always", res);
  });
});

var isBoss = false;
