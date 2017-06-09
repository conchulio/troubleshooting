// destination = 'observer/~dahora/someInvalidPath/';
// destination = 'ndt.iupui.mlab1.par01.measurement-lab.org:1337';
destination = 'router:1337/';
results = [];

var totalDuration = 2500;
var times = 101;
var interval = totalDuration/times;
var itemsProcessed = 0;

Array.apply(null, {length: times}).map(Number.call, Number).forEach(function(item, index) {
  setTimeout(function() {
    var request = new XMLHttpRequest();
    var alreadyAnswered = false;
    request.onreadystatechange = function () {
      var rtt = performance.now()-startTime;
      // console.log('readyState', this.readyState, rtt);
      // 2 is HEADERS_RECEIVED, 3 is LOADING, 4 is DONE
      // Actually only works on Firefox
      if (this.readyState===2 || this.readyState===3 || this.readyState===4) {
        if (alreadyAnswered) {
          return;
        }
        alreadyAnswered = true;
      // if (this.readyState===4) {
        results.push(rtt);
        // console.log('loading',this.readyState,'rtt',rtt);
        itemsProcessed+=1;
        if (itemsProcessed>=times) {
          showResults();
        }
      }
    };
    // request.onerror = function(err) {
    //   console.log('error', err);
    // };
    var inaccurateDate = Date.now();
    // console.log('opened');
    request.open('GET', 'http://'+destination+'?xyz='+inaccurateDate, true);
    // request.open('GET', 'http://www.ufrj.br/inexistent'+Date.now(), true);
    // request.open('GET', 'http://facebook.com/inexistent', true);
    // request.open('GET', 'http://ndt.iupui.mlab1.par01.measurement-lab.org:7123/inexistent'+Date.now(), true);
    var startTime = performance.now();
    request.send(inaccurateDate);
  }, index*interval);
});

function showResults() {
  console.log('results', results);
  console.log('min', results.reduce(function(a,b) {return Math.min(a,b)}));
  console.log('average', results.sum() / results.length);
}
Array.prototype.sum = function() {
  return this.reduce(function(a,b){return a+b;});
};

// websocket.onopen = function (event) {
//   console.log("Yeah opened it!");
// };
// websocket.onclose = function (event) {
//     var reason;
//     // See http://tools.ietf.org/html/rfc6455#section-7.4.1
//     if (event.code == 1000)
//         reason = "Normal closure, meaning that the purpose for which the connection was established has been fulfilled.";
//     else if(event.code == 1001)
//         reason = "An endpoint is \"going away\", such as a server going down or a browser having navigated away from a page.";
//     else if(event.code == 1002)
//         reason = "An endpoint is terminating the connection due to a protocol error";
//     else if(event.code == 1003)
//         reason = "An endpoint is terminating the connection because it has received a type of data it cannot accept (e.g., an endpoint that understands only text data MAY send this if it receives a binary message).";
//     else if(event.code == 1004)
//         reason = "Reserved. The specific meaning might be defined in the future.";
//     else if(event.code == 1005)
//         reason = "No status code was actually present.";
//     else if(event.code == 1006)
//        reason = "The connection was closed abnormally, e.g., without sending or receiving a Close control frame";
//     else if(event.code == 1007)
//         reason = "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message (e.g., non-UTF-8 [http://tools.ietf.org/html/rfc3629] data within a text message).";
//     else if(event.code == 1008)
//         reason = "An endpoint is terminating the connection because it has received a message that \"violates its policy\". This reason is given either if there is no other sutible reason, or if there is a need to hide specific details about the policy.";
//     else if(event.code == 1009)
//        reason = "An endpoint is terminating the connection because it has received a message that is too big for it to process.";
//     else if(event.code == 1010) // Note that this status code is not used by the server, because it can fail the WebSocket handshake instead.
//         reason = "An endpoint (client) is terminating the connection because it has expected the server to negotiate one or more extension, but the server didn't return them in the response message of the WebSocket handshake. <br /> Specifically, the extensions that are needed are: " + event.reason;
//     else if(event.code == 1011)
//         reason = "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.";
//     else if(event.code == 1015)
//         reason = "The connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).";
//     else
//         reason = "Unknown reason";

//     console.log("Closed for a reason!", reason);
// };
// websocket.onmessage = function (event) {
//   console.log("Yeah, message!");
// };
