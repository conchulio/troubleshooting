String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
}
var flattenObject = function(ob) {
  var toReturn = {}

  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue

    if ((typeof ob[i]) == 'object') {
      var flatObject = flattenObject(ob[i])
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue

        toReturn[x] = flatObject[x]
      }
    } else {
      toReturn[i] = ob[i]
    }
  }
  return toReturn
}

function removeResults() {
  // document.querySelector('.results').innerHTML = ''
  $('.results').empty()
}
function extractDoPing(fullResult) {
  var interestingAttributes = ['address','hostname','me','os','dst','count','lost','mean','std_dev','median']
  res = {}
  result = flattenObject(fullResult)
  for (var key in result) {
    value = result[key]
    if (typeof value === 'number') {
      value = +value.toFixed(2)
    }
    // console.log('typeof value', ''+key+JSON.stringify(value)+(typeof value))
    if (interestingAttributes.indexOf(key)>=0) {
      res[key] = value
    }
  }
  if (res.address === me.address) {
    res.me = true
  } else {
    res.me = false
  }
  res.dst = fullResult.result.params[0]
  res.count = fullResult.result.params[1].count
  console.log('interestingAttributes ping', interestingAttributes)
  console.log('res ping', res)
  return [res, interestingAttributes];
}
// TODO: fancy graph
// Figure out how to interpret the results
// Read paper about hidden terminals
function extractDoTraceroute(fullResult) {
  var interestingAttributes = ['address','hostname','me','os', 'dst']
  var result = fullResult.result
  res = {}
  res.os = result.os
  res.address = fullResult.address
  res.dst = result.result.dst
  res.hostname = fullResult.hostname
  for (var i=0; i<result.result.hops.length; i++) {
    var rtts = result.result.hops[i].rtt
    var sum = 0
    for (var j=0; j<rtts.length; j++)
      sum += rtts[j]
    var mean = +(sum/rtts.length).toFixed(2)
    res['hop'+i] = rtts.map(function(item) {return ''+item}).join("<br>")
    res['hop'+i] = '<span style="white-space: nowrap"><b>⌀ '+mean+"</b></span><br>"+res['hop'+i]
    res['hop'+i] = '<div style="text-align:right">'+res['hop'+i]+'</div>'
    interestingAttributes.push('hop'+i)
  }
  if (res.address === me.address) {
    res.me = true
  } else {
    res.me = false
  }
  console.log('interestingAttributes tr', interestingAttributes)
  console.log('res tr', res)
  return [res, interestingAttributes]
}

// Doesn't do anything to make Fathom crash later?
function createTable(resultsArray,title) {
  return
  var newResults = []
  for (var fullResultIndex in resultsArray) {
    var fullResult = resultsArray[fullResultIndex]
    // var interestingAttributesEach = {
    //   'doTraceroute':['address','lost','mean','std_dev','median']
    // }
    var methodName = title.split('.')[1]
    var [res,interestingAttributes] = eval('extract'+methodName.capitalize()+'(fullResult)');
    newResults[fullResultIndex] = res
  }
  resultsArray = newResults
  var results = document.querySelector('.results')
  var h1 = document.createElement('h1')
  h1.appendChild(document.createTextNode(title))
  results.appendChild(h1)
  var tbl = document.createElement('table')
  var tbody = document.createElement('tbody')
  var thead = document.createElement('thead')
  var className = document.createAttribute('class')
  className.value = 'table table-striped'
  tbl.setAttributeNode(className)
  // tbl.style.width = '100%'
  for (var i = 0; i < resultsArray.length+1; i++) {
      var tr = document.createElement('tr')
      var keys = Object.keys(resultsArray[0])
      var things
      if (i===0) {
        things = keys
      } else {
        // var address = resultsArray[i-1].address
        // delete resultsArray[i-1].address
        things = Object.keys(resultsArray[i-1]).map(function(item) {return resultsArray[i-1][item]})
      }
      for (var j = 0; j < interestingAttributes.length; j++) {
        var index = keys.indexOf(interestingAttributes[j])
        var elem;
        if (i === 0) {
          elem = document.createElement('th')
        } else {
          elem = document.createElement('td')
        }
        elem.innerHTML = things[index]
        tr.appendChild(elem)
      }
      if (i === 0) {
        thead.appendChild(tr)
      } else {
        tbody.appendChild(tr)
      }
  }
  tbl.appendChild(thead)
  tbl.appendChild(tbody)
  results.appendChild(tbl)
  $('th:contains("hop")').css('text-align', 'right')
}

var bossHostname = 'iMachine'
var bossHostname = 'lenovolinux'
var me = null
// var firstMeasurement = true
var firstHopIpAddress = null

var manifest = {
  'description' : 'Start some random tools',
  'api' : [
    'tools.discovery',
    'tools.getMlabServer',
    'tools.remoteapi.*',
    'system.*',
  ],
  'destinations' : ['80.239.168.203']
}
                            // Minutes
var interMeasurementDelay = (1/6)*60*1000

function doFathomThings() {
  console.log("Start fathom things")
  if (typeof(fathom) !== 'undefined') {
    fathom.init(function(res) {
      document.querySelector(".results").innerHTML = "Initialized Fathom, processing..."
      console.log("Initialization suceeded")
      if (res.error)
        throw "init failed: " + JSON.stringify(res.error)
      fathom.tools.remoteapi.start(function(res) {
        if (res.error)
          throw "starting remoteapi failed: " + JSON.stringify(res.error)
        startMeasurement()
      })
    }, manifest)
  } else {
    console.log("Refreshing fathom")
    document.querySelector(".results").innerHTML = "Fathom not defined, addon not installed?"
    setTimeout(function() {document.location.reload(false)},1000)
  }
}

function startMeasurement() {
  // fathom.tools.getMlabServer(function(res) {
  //   console.log("mlab", res)
  // })
  console.log("current time", Date.now())
  removeResults()
  fathom.system.getHostname(function(res) {
    var hostname = res.result.split('.')[0]
    if (res.error)
      throw "error in hostname"+res.error
    console.log('getHostname', res)
    fathom.system.doTraceroute(function(res) {
      if (res.error)
        throw "traceroute failed: " + res.error
      console.log('traceroute res', res)
      firstHopIpAddress = res.result.hops[0].address
      // console.log(firstHopIpAddress)
      var deviceSet = new Set()
      var localDiscoverySet = new Set()
      me = null
      fathom.tools.discovery(function(node, done) {
        localDiscoverySet.add(node)
        console.log(node)
        if (done) {
          me = Array.from(localDiscoverySet)[0]
          me.address = me.ipv4
          me.hostname = hostname
          fathom.tools.remoteapi.start(function(res,doneStart) {
            if (res.error) {
              throw 'Error when starting the remoteapi: '+JSON.stringify(res.error)
            }
            console.log('done remoteapi start', doneStart)
            fathom.tools.remoteapi.discovery(function discoveryCallback(node,done) {
              console.log("At least something happened in the remoteapi");
              if (node.error) {
                throw 'Error when starting the remoteapi: '+JSON.stringify(node.error)
              }
              if (Object.keys(node).length > 0) {
                deviceSet.add(node)
              }
              console.log('discovery callback')
              console.log('discovery node', node)
              console.log('discovery done', done)
              if (done) {
                console.log("discovered everything")
                var allNodes = Array.from(deviceSet)
                if (allNodes.length === 1) {
                  throw "Only node "+allNodes[0].hostname+" discovered. That's bad"
                } else if (allNodes.length === 0) {
                  throw "No nodes discovered. That's bad"
                }
                console.log('allNodes',allNodes)
                coordinateMeasurement(allNodes);
              }
            }, 1/*s*/)
          })
        }
      }, ['local'])
    }, manifest.destinations[0])
  })
}

function coordinateMeasurement(allNodes) {
  // console.log('destination', manifest.destinations[0])
  if (me.hostname === bossHostname) {
    console.log("Scheduled new measurement")
    setTimeout(function(){coordinateMeasurement(allNodes)}, interMeasurementDelay)
    // coordinateMeasurement(allNodes)
    var thingsToDo =
      [['system.doPing', [manifest.destinations[0], {count: 10, interval: 0.2}]],
      // ['system.doTraceroute', [manifest.destinations[0], {count : 4, sendwait: 0}]]
      ['system.doPing', [firstHopIpAddress, {count: 10, interval: 0.2}]],
      // Pings the other node. Works only for a maximum of two nodes!!!
      ['system.doPing', ['otherNode', {count: 10, interval: 0.2}]],
      ['system.doPing', ['127.0.0.1', {count: 10, interval: 0.2}]]]
    var eachCounter = new Array(thingsToDo.length).fill(null).map(function(item) {return 0})
    var resultsArray = new Array(thingsToDo.length).fill(null).map(function(item) {return []})
    console.log('eachCounter', JSON.stringify(eachCounter))
    console.log('resultsArray', JSON.stringify(resultsArray));
    (function(submitted){
      allNodes.forEach(function(currentNode,nodeIndex) {
        console.log('currentNode',JSON.stringify(currentNode))
        thingsToDo.forEach(function(args,index) {
          console.log('argsForEachThing',JSON.stringify(args))
          console.log('indexForEachThing',JSON.stringify(index))
          var params = JSON.parse(JSON.stringify(args[1]))
          if (params[0] === 'otherNode') {
            params[0] = allNodes[1-nodeIndex].address
            console.log("other node's adress",params[0])
          }
          fathom.tools.remoteapi.makereq(function(fullResult, done) {
            if (fullResult.error) {
              throw 'Error occurred in a result: ' + JSON.stringify(fullResult.error)
            }
            fullResult.hostname = currentNode.hostname
            console.log('fullResult', fullResult);
            console.log('currentNode', JSON.stringify(currentNode))
            console.log("index", JSON.stringify(index))
            console.log("allNodes.indexOf(currentNode)", JSON.stringify(allNodes.indexOf(currentNode)))
            console.log('method', JSON.stringify(args[0]))
            console.log('params', JSON.stringify(args[1]))
            if(!done) {
              resultsArray[index][allNodes.indexOf(currentNode)] = fullResult
              console.log('resultsArray', JSON.stringify(resultsArray))
              eachCounter[index] += 1
            } else if (done && fullResult.timeout) {
              console.log("Connection terminated by remote host, saving data")
              console.log('eachCounter',JSON.stringify(eachCounter))
              // if (eachCounter[index] === allNodes.length) {
                var allCountersFull = true
                for (var currentCounterIndex in eachCounter) {
                  var currentCounter = eachCounter[currentCounterIndex]
                  if (currentCounter !== allNodes.length)
                    allCountersFull = false
                }
                // console.log('me', me)
                // console.log("Asked every node for index", index)
                if (!submitted) {
                  submitted = true
                  try {
                    // createTable(resultsArray[index],args[0])
                    // if (allCountersFull) {
                      console.log('posting data');
                      $.ajax({
                        type: "POST",
                        url: '/new_file',
                        data: JSON.stringify(resultsArray),
                        contentType: "application/json",
                        // data: {}
                      }).done(function(res) {
                        console.log("done", res);
                      }).fail(function(res) {
                        console.log("fail", res);
                      }).always(function(res) {
                        console.log("always", res);
                      });
                    // }
                  } catch (e) {
                    console.error("error occurred", e)
                  }
                }
              // }
            }
          }, currentNode, args[0], params)
        })
      })
    })(false)
  }
}

doFathomThings()