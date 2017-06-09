function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

function calculateTValueForCorrelation(correlation, sampleSize) {
  return correlation/Math.sqrt((1-correlation*correlation)/(sampleSize-2));
}

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

Array.prototype.aggregateMean = function(number) {
  var aggregate = [];
  var intermediateArray = [];
  for (var i=0; i<this.length; i++) {
    intermediateArray.push(this[i]);
    if (intermediateArray.length % number === 0) {
      aggregate.push(intermediateArray.getMean());
      intermediateArray = [];
    }
  }
  if (intermediateArray.length > 0) {
    throw("There are extra elements left");
  }
  return aggregate;
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

JSON.flatten = function(data, maxDepth) {
  maxDepth = maxDepth || Infinity;
  var result = {};
  function recurse (cur, prop, depth) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      for(var i=0, l=cur.length; i<l; i++)
        recurse(cur[i], prop + "[" + i + "]");
      if (l == 0)
        result[prop] = [];
    } else {
      var isEmpty = true;
      if (depth < maxDepth)
        for (var p in cur) {
          isEmpty = false;
          recurse(cur[p], prop ? prop+"."+p : p, depth+1);
        }
      else {
        result[prop] = cur;
        return;
      }
      if (isEmpty && prop)
        result[prop] = {};
    }
  }
  recurse(data, "", 0);
  return result;
}

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setRandomArray(length) {
  // console.log('array length', length);
  randomArray = new Uint8Array(length);
  for (var i = 0; i < randomArray.length; i++) {
    randomArray[i] = getRandomInt(0,255);
  }
}

module.exports = {
  setRandomArray: setRandomArray,
  ab2str: ab2str,
  str2ab: str2ab,
  clone: clone,
  calculateTValueForCorrelation: calculateTValueForCorrelation,
};
