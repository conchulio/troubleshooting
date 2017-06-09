Array.prototype.getMedian = function() {
  var result = [];
  var sortedArr = this.sort(function(num1, num2) {
    return num1 - num2;
  });
  // result.push("sortedArr is: [" + sortedArr.toString() + "]");
  var medianIndex = Math.floor(sortedArr.length / 2);
  if (this.length % 2 === 0) {
    return (sortedArr[medianIndex-1] + sortedArr[medianIndex]) / 2;
  } else {
    return sortedArr[medianIndex];
  }
}

Array.prototype.getMean = function() {
  return this.reduce(function(x,y) {return x+y;})/this.length;
}

Array.prototype.getMeanPopulation = function() {
  return this.reduce(function(x,y) {return x+y;})/(this.length-1);
}

Array.prototype.getStdev = function() {
  var avg = this.getMean();

  var squareDiffs = this.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });

  var avgSquareDiff = squareDiffs.getMean();
  // var avgSquareDiff = squareDiffs.getMean2();

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

Array.prototype.getStdevPopulation = function() {
  var avg = this.getMean();

  var squareDiffs = this.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });

  // var avgSquareDiff = squareDiffs.getMean();
  var avgSquareDiff = squareDiffs.getMeanPopulation();

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

Array.prototype.shuffle = function() {
  var j, x, i;
  for (i = this.length; i; i -= 1) {
    j = Math.floor(Math.random() * i);
    x = this[i - 1];
    this[i - 1] = this[j];
    this[j] = x;
  }
}

Array.prototype.min = function() {
  return Math.min.apply(null, this);
}

Array.prototype.max = function() {
  return Math.max.apply(null, this);
}

var mannwhitneyuTest = require('./js/mannwhitneyu');

var Sequelize = require("sequelize");
var db = require('./models/index');
var sequelize = db.sequelize;
var models = require('./models');
var Result = models.Result;
var _ = require('underscore');
// var jQuery = require('jquery')((require("jsdom").jsdom().defaultView));

"gute messung 17:53 bis 18:13"
"schlechte messung 15:29 bis 15:50"

// var pValues = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.2, 0.3];
// var steps = 20
// var routerStart = 0.0;
// var routerEnd = 0.02;
// var peerStart = 0.1;
// var peerEnd = 0.2;
// var serverStart = 0.01;
// var serverEnd = 0.02;
// var pValuesToTestRouter = _.range(routerStart, routerEnd, (routerEnd-routerStart)/steps);
// var pValuesToTestPeer = _.range(peerStart, peerEnd, (peerEnd-peerStart)/steps);
// var pValuesToTestServer = _.range(serverStart, serverEnd, (serverEnd-serverStart)/steps);
var pValuesToTestRouter = _.range(0.0, 1.0, 0.02);
var pValuesToTestPeer = _.range(0.0, 1.0, 0.02);
var pValuesToTestServer = _.range(0.0, 1.0, 0.02);


// // First crappy dataset
// var badWifiBadDevice = 33;
// var badWifiGoodDevice = 36;
// startDateBad = new Date('2016-06-10 15:29');
//
// var goodWifiDevice1 = 1;
// var goodWifiDevice2 = 2;
// startDateGood = new Date('2016-06-10 17:53');

// Second better dataset (actually doesn't work)
// var badWifiBadDevice = 6; // Controller
// var badWifiGoodDevice = 7;
// startDateBad = new Date('2016-06-15 17:30');
//
// var goodWifiDevice1 = 2; // Controller
// var goodWifiDevice2 = 1;
// startDateGood = new Date('2016-06-14 18:13');

// startDateGood: 14:55
// id: 8, 10

var badWifiBadDevice = 2; // Controller
var badWifiGoodDevice = 1;
startDateBad = new Date('2016-06-17 12:15');

var goodWifiDevice1 = 8; // Controller
var goodWifiDevice2 = 10;
startDateGood = new Date('2016-06-16 14:55');

var query = 'select row_number() over(order by date)-1 AS "rowNumber", "target", array_agg(rtt) from (select * from "Results" where "socketId" = :socketId and "date" > :startDate ) as "filteredResults" group by "date", "target" order by "date", "target" limit 300';
var badBad = null;
var badGood = null;
var good2 = null;
var good1 = null;
sequelize.query(query, {replacements: {
  socketId: badWifiBadDevice,
  startDate: startDateBad,
}}).then(function(result) {
  console.log('result bad bad', result[0].length);
  // console.log('result bad bad', result[0]);
  badBad = result[0];
  return sequelize.query(query, {replacements: {
    socketId: badWifiGoodDevice,
    startDate: startDateBad,
  }});
}).then(function(result) {
  console.log('result bad good', result[0].length);
  // console.log('result bad good', result[0]);
  badGood = result[0];
  return sequelize.query(query, {replacements: {
    socketId: goodWifiDevice2,
    startDate: startDateGood,
  }});
}).then(function(result) {
  console.log('result good2', result[0].length);
  // console.log('result good2', result[0]);
  good2 = result[0];
  return sequelize.query(query, {replacements: {
    socketId: goodWifiDevice1,
    startDate: startDateGood,
  }});
}).then(function(result) {
  console.log('result good1', result[0].length);
  // console.log('result good1', result[0]);
  good1 = result[0];
  var bestPs = [];
  var bestRocValue = Infinity;
  var results = []
  console.log("Before loop");

  var badAllStuff = [[[],[],[]],[[],[],[]]];
  for (var i=0; i<badBad.length/3; i++) {
    var index = i*3;
    // console.log("bad index", index);
    var evaluatedData = evaluate(badBad[index+1]['array_agg'],badGood[index+1]['array_agg'],badBad[index]['array_agg'],badGood[index]['array_agg'],badBad[index+2]['array_agg'],badGood[index+2]['array_agg']);
    results.push({bad: true, consistent: evaluatedData.consistent, calculatedPValues: evaluatedData.pValues});
    badAllStuff[0][0] = badAllStuff[0][0].concat(badBad[index+1]['array_agg']);
    badAllStuff[1][0] = badAllStuff[1][0].concat(badGood[index+1]['array_agg']);
    badAllStuff[0][1] = badAllStuff[0][1].concat(badBad[index]['array_agg']);
    badAllStuff[1][1] = badAllStuff[1][1].concat(badGood[index]['array_agg']);
    badAllStuff[0][2] = badAllStuff[0][2].concat(badBad[index+2]['array_agg']);
    badAllStuff[1][2] = badAllStuff[1][2].concat(badGood[index+2]['array_agg']);
  }
  console.log('badMeans', badAllStuff.map(function(dataset) {return dataset.map(function(target) {return target.getMean();});}));
  console.log("bad r values", [0,1,2].map(function(index) {return results.map(function(result) {return result.calculatedPValues[index];}).getMean();}));
  var goodAllStuff = [[[],[],[]],[[],[],[]]];
  var goodResults = [];
  for (var i=0; i<good2.length/3; i++) {
    var index = i*3;
    // console.log("good index", index);
    var evaluatedData = evaluate(good2[index+1]['array_agg'],good1[index+1]['array_agg'],good2[index]['array_agg'],good1[index]['array_agg'],good2[index+2]['array_agg'],good1[index+2]['array_agg']);
    goodResults.push({bad: false, consistent: evaluatedData.consistent, calculatedPValues: evaluatedData.pValues});
    goodAllStuff[0][0] = goodAllStuff[0][0].concat(good2[index+1]['array_agg']);
    goodAllStuff[1][0] = goodAllStuff[1][0].concat(good1[index+1]['array_agg']);
    goodAllStuff[0][1] = goodAllStuff[0][1].concat(good2[index]['array_agg']);
    goodAllStuff[1][1] = goodAllStuff[1][1].concat(good1[index]['array_agg']);
    goodAllStuff[0][2] = goodAllStuff[0][2].concat(good2[index+2]['array_agg']);
    goodAllStuff[1][2] = goodAllStuff[1][2].concat(good1[index+2]['array_agg']);
  }
  console.log("good r values", [0,1,2].map(function(index) {return goodResults.map(function(result) {return result.calculatedPValues[index];}).getMean();}));
  results = results.concat(goodResults);
  console.log('goodMeans', goodAllStuff.map(function(dataset) {return dataset.map(function(target) {return target.getMean();});}));
  console.log("After loop results");
  // console.log("results",results);return;
  // console.log("pValuesToTestRouter", pValuesToTestRouter);
  for (var routerPIndex=0; routerPIndex<pValuesToTestRouter.length; routerPIndex++) {
    var routerP = pValuesToTestRouter[routerPIndex];
    // console.log("pValuesToTestPeer", pValuesToTestPeer);
    for (var peerPIndex=0; peerPIndex<pValuesToTestPeer.length; peerPIndex++) {
      var peerP = pValuesToTestPeer[peerPIndex];
      // console.log("pValuesToTestServer", pValuesToTestServer);
      for (var serverPIndex=0; serverPIndex<pValuesToTestServer.length; serverPIndex++) {
        var serverP = pValuesToTestServer[serverPIndex];
        var clonedResults = JSON.parse(JSON.stringify(results));
        for (var i = 0; i < results.length; i++) {
          // if (clonedResults[i].calculatedPValues[1]>peerP) {
          //   clonedResults[i] = null;
          // } else {
            clonedResults[i].calculatedBad = clonedResults[i].calculatedPValues[0]>routerP && clonedResults[i].calculatedPValues[1]<peerP && clonedResults[i].calculatedPValues[2]>serverP && clonedResults[i].consistent;
          // }
        }
        // console.log('clonedResults', clonedResults);\
        var sensitivityValue = sensitivity(clonedResults);
        var fpRateValue = fpRate(clonedResults);
        var rocValue = Math.sqrt(Math.pow(1-sensitivityValue,2)+Math.pow(fpRateValue,2));
        // console.log('rocValue', rocValue, routerP, peerP, serverP, sensitivityValue, fpRateValue);
        if (rocValue < bestRocValue) {
          console.log("Found better Roc Value", rocValue, "for", routerP, peerP, serverP, 'tp rate', sensitivityValue, 'fp rate', fpRateValue);
          console.log("Filtered values", clonedResults.filter(function(item) {return item;}).length);
          bestRocValue = rocValue;
          bestSensitivity = sensitivityValue;
          bestFpRate = fpRateValue;
          bestPs = [routerP, peerP, serverP];
        }
        // sqrt((1-tp)^2+fp^2)
      }
    }
  }
  // console.log("results", results);
  console.log("bestRocValue", bestRocValue, "bestPs", bestPs);
});

function evaluate(router1, router2, peer1, peer2, server1, server2) {
  var routerMean1 = router1.getMean();
  var routerMean2 = router2.getMean();
  var serverMean1 = server1.getMean();
  var serverMean2 = server2.getMean();
  // var routerPCalculated = mannwhitneyuTest(router1,router2).p;
  // var peerPCalculated = mannwhitneyuTest(peer1,peer2).p;
  // var serverPCalculated = mannwhitneyuTest(server1,server2).p;
  var routerPCalculated = 1-((2*mannwhitneyuTest(router1,router2).U)/(router1.length*router2.length));
  var peerPCalculated = 1-((2*mannwhitneyuTest(peer1,peer2).U)/(peer1.length*peer2.length));
  var serverPCalculated = 1-((2*mannwhitneyuTest(server1,server2).U)/(server1.length*server2.length));
  return {pValues: [routerPCalculated, peerPCalculated, serverPCalculated], consistent: ((routerMean1<routerMean2)===(serverMean1<serverMean2))};
}

function sensitivity(results) {
  var actuallyPositives = results.filter(function(item) {return item && item.bad});
  var truePositives = results.filter(function(item) {return item && item.bad && item.calculatedBad});
  return truePositives.length/actuallyPositives.length;
}

function fpRate(results) {
  var actuallyNegatives = results.filter(function(item) {return item && !item.bad});
  var falsePositives = results.filter(function(item) {return item && !item.bad && item.calculatedBad});
  return falsePositives.length/actuallyNegatives.length;
}
