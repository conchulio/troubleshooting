console.log("Loaded main script");

var isWorker = false;
var common = require('./common');

var Measurement = common.Measurement;

var measurement = new Measurement();
measurement.gui = require('./gui');
