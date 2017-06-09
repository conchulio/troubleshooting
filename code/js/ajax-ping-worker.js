var isWorker = true;
var common = require('./common');

var measurement = new common.Measurement(true);

// Monkey patch send Results function
measurement.sendResults = function(thing, destination, batchNumber) {
  // console.log('sendResults', thing, destination, batchNumber);
  if (!measurement.resultsToTransmit[thing+'-'+destination+'-'+batchNumber])
    return;

  this.resultsToTransmit[thing+'-'+destination+'-'+batchNumber].data = this.batches[thing+'-'+destination+'-'+batchNumber].slice(1);
  postMessage(['sendingResults', this.resultsToTransmit[thing+'-'+destination+'-'+batchNumber]]);
  delete this.batches[thing+'-'+destination+'-'+batchNumber];
  delete this.resultsToTransmit[thing+'-'+destination+'-'+batchNumber];
  // console.log('thing',thing, 'destination', destination, 'deleted batch',batchNumber);
}

onmessage = function(event) {
  console.log('Worker executing', event.data[0]);
  switch (event.data[0]) {
    case 'performMeasurement':
      // console.log("Got these arguments", event.data);
      measurement.ownId = event.data[2];
      measurement.likelyWiFiRouterIpAddress = event.data[3];
      measurement.mlabServer = event.data[4];
      measurement.accessIp = event.data[5];
      measurement.batchNumber = event.data[6];
      measurement.measurement(event.data[1]);
      break;
    case 'beginMeasurement':
      measurement.beginAjaxMeasurement.call(null, event.data[1]);
      break;
  }
}
