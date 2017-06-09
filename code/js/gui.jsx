var React = require('react');
var ReactDOM = require('react-dom');
var tTest = require('./statistics');
var jStat = require('jstat').jStat;
var NetGraph = require('./homenet');
var _ = require('underscore');
// console.log('jStat', jStat.studentt.pdf);

var ownDeviceName = 'this device';
var significanceThreshold = 0.05;

function changeNames(first, second) {
  if (first==window.ownId)
    first = ownDeviceName;
  else
    first = 'device '+first+'';
  if (second==window.ownId)
    second = ownDeviceName;
  else
    second = 'device '+second+'';
  return [first, second];
}

function round(number, digits) {
  return Math.round(number * (Math.pow(10,digits))) / Math.pow(10,digits);
}

var RelationElement = React.createClass({
  render: function() {
    var first = this.props.first;
    var second = this.props.second;
    var smaller = this.props.smaller;
    if (this.props.significantly) {
      var significantly = 'significantly';
    } else {
      var significantly = '';
    }
     if (smaller)
      return <span>{first.capitalizeFirst()} is <span className="better">{significantly} better</span> than {second}</span>;
    else
      return <span>{first.capitalizeFirst()} is <span className="worse">{significantly} worse</span> than {second}</span>;
  }
});

<div class="progress">
  <div class="bar" style="width: 60%;"></div>
</div>

var MeasurementDeviceComparison = React.createClass({
  render: function() {
    var stats = this.props.statistics;
    // console.log("stats", JSON.stringify(stats));
    var createComparisonElement = function(first, second) {
      var router = stats[0][first+'-'+second];
      var peer = stats[1][first+'.'+second+'-'+second+'.'+first];
      var server = stats[2][first+'-'+second];
      // console.log('beginning first', first, 'second', second, 'router.smaller', router.smaller, 'server.smaller', server.smaller);
      [first, second] = changeNames(first, second);
      var routerSmaller = router.smaller;
      var peerSmaller = peer.smaller;
      var serverSmaller = server.smaller;
      // console.log('before first', first, 'second', second, 'router.smaller', routerSmaller, 'server.smaller', serverSmaller);
      if (second===ownDeviceName) {
        [first, second] = [second, first];
        routerSmaller = !routerSmaller;
        peerSmaller = !peerSmaller;
        serverSmaller = !serverSmaller;
      }
      var interpretation = function() {
        // console.log('later first', first, 'second', second, 'router.smaller', routerSmaller, 'server.smaller', serverSmaller);
        if (routerSmaller===serverSmaller &&
            router.p < significanceThreshold && server.p < significanceThreshold &&
            peer.p >= significanceThreshold) {
          return (<div><span className="interpretation interpretation-difference"><RelationElement first={first} second={second} significantly={true} smaller={routerSmaller} /></span></div>);
        } else if (peer.p < significanceThreshold) {
          return (<div><span className="interpretation interpretation-error">The measurement did not succeed, please repeat it</span></div>);
        } else {
          return (<div><span className="interpretation interpretation-no-difference">There is no significant difference</span></div>);
        }
      };
      // console.log("Hello I'm here");
      return (<li key={'createResult'+'-'+first+'-'+second}>
        <h3>Comparison between {first} and {second}</h3>
        <div>Router: <RelationElement first={first} second={second} smaller={routerSmaller} /></div>
        <div>Server: <RelationElement first={first} second={second} smaller={serverSmaller} /></div>
        {interpretation()}
        {/*<div>p-Values: router: {round(router.p,2)}, peer: {round(peer.p,2)}, server: {round(server.p,2)}</div>*/}
        <div>p-Values: router: {router.p}, peer: {peer.p}, server: {server.p}</div>
        <div>U-Values: router: {router.U}, peer: {peer.U}, server: {server.U}</div>
        <div>r-Values: router: {router.r}, peer: {peer.r}, server: {server.r}</div>
      </li>);
    };
    if (!this.props.statistics) {
      return (<div></div>);
    }
    return (
      <div>
        <h1>Comparison between devices</h1>
        <ul>
        {Object.keys(stats[0]).map(function(item) {
          var split = item.split('-');
          return createComparisonElement(split[0], split[1]);
        })}
        </ul>
      </div>
    );
  }
});

var previousNodes = null;
function drawCanvas(that) {
  var nodes = that.state.nodes;
  if (nodes.length===0) {
    return;
  }
  if (!window.graph) {
    window.graph = new NetGraph('.canvas', false);
  }
  var g = window.graph;

  // console.log('nodes', nodes);
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    nodes[i] = g.addNode(node);
  }
  // console.log("nodes after inserting", nodes);

  if (previousNodes!==null) {
    // console.log('prev, current', previousNodes, nodes);
    // console.log('id prev, current', previousNodes.map(function(item) {return item.id;}), nodes.map(function(item) {return item.id;}));
    var nodeIdsToDelete = _.difference(previousNodes.map(function(item) {return item.id;}), nodes.map(function(item) {return item.id;}));
    // console.log("nodes to delete", nodeIdsToDelete);
    for (var i = 0; i < nodeIdsToDelete.length; i++) {
      var currentId = nodeIdsToDelete[i];
      var nodeToDelete = _.find(previousNodes, function(node) {
          return (node.id===currentId);
      });
      // console.log('node to delete', nodeToDelete);
      g.removeNode(nodeToDelete);
    }
  }

  g.redraw();
  // console.log('nodes', JSON.stringify(nodes));
  previousNodes = nodes;
}

var GraphCanvas = React.createClass({
  render: function() {
    // console.log("Render GraphCanvas");
    return <div id="canvas" />;
  },
  componentWillReceiveProps: function(nextProps) {
    if (typeof(nextProps.nodes)!=='undefined') {
      this.setState({nodes: nextProps.nodes});
    }
  },
  componentWillMount: function() {
    // var that = this;
    // window.setNodes = function(nodes) {
    //   that.setState({nodes: nodes});
    // };
  },
  getInitialState: function() {
    return {nodes: []};
  },
  componentDidMount: function() {var that = this; drawCanvas(that);},
  componentDidUpdate: function() {var that = this; drawCanvas(that);}
});

var MeasurementGlobalComparison = React.createClass({
  render: function() {
    if (!this.props.results) {
      return (<div />);
    }
    results = this.props.results;

    // console.log('Global comp results', results[0]);
    var validPeers = Object.keys(results[0]).filter(function(item) {return item!=='stats';});
    // console.log('validPeers', validPeers);

    var showPValues = function(routerP, serverP) {
      return <span>router-p: {round(routerP,2)}, server-p: {round(serverP,2)}</span>;
    }

    return (
      <div>
        <h1>Global Comparison</h1>
        <ul className="global-comparison-list">
          {validPeers.map(function(peer) {
            // console.log('router value', results[0][peer].mean,Math.pow(results[0][peer].stdev,2),results[0][peer]['data'].length,results[0].stats.average,results[0].stats.variance,results[0].stats.totalCount);
            var [routerDf, routerT] = tTest(results[0][peer].mean,
                                            Math.pow(results[0][peer].stdev,2),
                                            results[0][peer]['data'].length,
                                            results[0].stats.average,
                                            results[0].stats.variance,
                                            results[0].stats.totalCount
                                          );
            var routerP = jStat.studentt.pdf(routerT, routerDf);
            // console.log('server value', results[2][peer].mean,Math.pow(results[2][peer].stdev,2),results[2][peer]['data'].length,results[2].stats.average,results[2].stats.variance,results[2].stats.totalCount);
            var [serverDf, serverT] = tTest(results[2][peer].mean,
                                            Math.pow(results[2][peer].stdev,2),
                                            results[2][peer]['data'].length,
                                            results[2].stats.average,
                                            results[2].stats.variance,
                                            results[2].stats.totalCount
                                          );
            var serverP = jStat.studentt.pdf(serverT, serverDf);
            // TODO Implement comparison between each machine and the global average
            // and show it only if it is significant.

            // console.log('results[0][peer].mean,results[0].average', results[0][peer].mean,results[0].stats.average);
            // console.log('first',peer, 'smaller',results[0][peer].mean < results[0].stats.average);
            [first,] = changeNames(peer)
            if ((results[0][peer].mean < results[0].stats.average)===(results[2][peer].mean < results[2].stats.average) &&
                routerP < significanceThreshold && serverP < significanceThreshold) {
              return <li key={"global_comparison"+'-'+peer}><RelationElement first={first} second="the global average" smaller={results[0][peer].mean < results[0].stats.average} significantly={true} />, {showPValues(routerP, serverP)}</li>;
            } else {
              return <li key={"global_comparison"+'-'+peer}><span>{first.capitalizeFirst()+"'"}s delays are close to the average</span>, {showPValues(routerP, serverP)}</li>;
            }
          })}
        </ul>
      </div>
    );
  }
});

var MeasurementRawResults = React.createClass({
  render: function() {
    if (!this.props.results) {
      return (<div />);
    }
    var that = this;
    var createResult = function(result, fromMachine, toMachine, index) {
      [fromMachine, toMachine] = changeNames(fromMachine, toMachine);
      var betterThan = function() {
        if (result.betterThan) {
          return (<span><b>better than:</b> {round(result.betterThan*100,2)} %<br/></span>);
        } else {
          return (<span/>);
        }
      }
      var ajaxSelfCorrelation = function() {
        if (result.ajaxSelfCorrelation) {
          return (<span><b>ajaxCorr:</b> {round(result.ajaxSelfCorrelation,2)} <b>p:</b> {round(result.ajaxP,2)}<br/></span>);
        } else {
          return (<span/>);
        }
      }
      return (
        <div key={'createResult'+'-'+index+'-'+fromMachine+'-'+toMachine}>
          <h3>Measurement from {fromMachine} to {toMachine}</h3>
          <RelationElement first={fromMachine} second="the global average" smaller={result.mean < that.props.results[index].stats.average} />
          <p>
            <b>median:</b> {round(result.median,2)} ms<br/>
            <b>mean:</b> {round(result.mean,2)} ms<br/>
            <b>stdev:</b> {round(result.stdev,2)} ms<br/>
            <b>min:</b> {round(result.min,2)} ms<br/>
            <b>max:</b> {round(result.max,2)} ms<br/>
            <b>length:</b> {round(result.data.length,2)}<br/>
            <b>lost:</b> {round(result.lost,2)}<br/>
            {betterThan()}
            {ajaxSelfCorrelation()}
            <b>On {result.browser} on {result.os}</b>
          </p>

        </div>
      );
    }
    var createNormalResults = function(resultsForTargetWithStats, target, index) {
      var resultsForTarget = {};
      for (var key in resultsForTargetWithStats) {
        if (key!=='stats')
          resultsForTarget[key] = resultsForTargetWithStats[key];
      }
      // console.log('results normal', resultsForTarget);
      return (
        <div>
          {Object.keys(resultsForTarget).map(function(key) {return createResult(resultsForTarget[key], key, target, index)})}
        </div>
      );
    }
    var createPeerResults = function(resultsForTargetWithStats) {
      var resultsForTarget = {};
      for (var key in resultsForTargetWithStats) {
        if (key!=='stats')
          resultsForTarget[key] = resultsForTargetWithStats[key];
      }
      return (
        <div>
          {Object.keys(resultsForTarget).map(function(key) {
            return Object.keys(resultsForTarget[key]).map(function(target) {
              return createResult(resultsForTarget[key][target], key, target, 2);
            });
          })}
        </div>
      );
    }
    // console.log('all results',this.props.results);
    results = this.props.results;
    return (
      <div className="outer-raw-results-div">
        <h1>Raw results</h1>
        <div className="inner-raw-results-div">
          <h2>Router</h2>
          <div>global: avg: {round(results[0].stats.average,2)}, median: {round(results[0].stats.median,2)}, stdev: {round(results[0].stats.stdev,2)}, min: {round(results[0].stats.min,2)}, max: {round(results[0].stats.max,2)}</div>
          {createNormalResults(results[0], 'router', 0)}
        </div>
        <div className="inner-raw-results-div">
          <h2>Peer</h2>
          <div>global: avg: {round(results[1].stats.average,2)}, median: {round(results[1].stats.median,2)}, stdev: {round(results[1].stats.stdev,2)}, min: {round(results[1].stats.min,2)}, max: {round(results[1].stats.max,2)}</div>
          {createPeerResults(results[1])}
        </div>
        <div className="inner-raw-results-div">
          <h2>Server</h2>
          <div>global: avg: {round(results[2].stats.average,2)}, median: {round(results[2].stats.median,2)}, stdev: {round(results[2].stats.stdev,2)}, min: {round(results[2].stats.min,2)}, max: {round(results[2].stats.max,2)}</div>
          {createNormalResults(results[2], 'server', 2)}
        </div>
        <div className="inner-raw-results-div">
          <h2>Self</h2>
          <div>global: avg: {round(results[3].stats.average,2)}, median: {round(results[3].stats.median,2)}, stdev: {round(results[3].stats.stdev,2)}, min: {round(results[3].stats.min,2)}, max: {round(results[3].stats.max,2)}</div>
          {createNormalResults(results[3], 'self', 3)}
        </div>
      </div>
    );
  }
});

var MeasurementWiFiResults = React.createClass({
  render: function() {
    if (!this.props.results) {
      return (<div />);
    }
    var that = this;
    var createResult = function(result, fromMachine, toMachine, index) {
      console.log("createResult, result", result);
      [fromMachine, toMachine] = changeNames(fromMachine, toMachine);
      return (
        <div key={'createResult'+'-'+index+'-'+fromMachine+'-'+toMachine}>
          <h2>Measurement from {fromMachine} to {toMachine}</h2>
          {Object.keys(result.prediction).map(function(key) {
            return(<div>
              <h3>{key}</h3>
              <div key={'createResultWiFi'+'-'+index+'-'+fromMachine+'-'+toMachine} className="progress">
                <div className="progress-bar" role="progressbar" style={{width: (result.prediction[key]*100)+"%"}}></div>
              </div>
            </div>);
          })}
        </div>
      );
    };
    var createNormalResults = function(resultsForTargetWithStats, target, index) {
      var resultsForTarget = {};
      for (var key in resultsForTargetWithStats) {
        if (key!=='stats')
          resultsForTarget[key] = resultsForTargetWithStats[key];
      }
      // console.log('results normal', resultsForTarget);
      return (
        <div>
          {Object.keys(resultsForTarget).map(function(key) {return createResult(resultsForTarget[key], key, target, index)})}
        </div>
      );
    };
    // console.log('all results',this.props.results);
    var results = this.props.results;
    return (
      <div className="wifi-results-div">
        <h1>WiFi comparison</h1>
        {createNormalResults(results[0], 'router', 0)}
      </div>
    );
  }
});

// FIXME Don't have global getter/setter functions but instead use module.exports
var MeasurementApp = React.createClass({
  getInitialState: function() {
    return {results: null, statistics: null, measurementRunning: false};
  },
  componentWillMount: function() {
    // var that = this;
    // window.setMeasurementRunning = function(measurementRunning) {
    //   that.setState({measurementRunning: measurementRunning});
    // };
    // window.setResults = function(results) {
    //   that.setState({results: results});
    // };
    // window.setStatistics = function(statistics) {
    //   that.setState({statistics: statistics});
    // };
  },
  componentWillReceiveProps: function(nextProps) {
    // console.log('nextProps', nextProps);
    if (typeof(nextProps.measurementRunning)!=='undefined') {
      this.setState({measurementRunning: nextProps.measurementRunning});
    }
    if (typeof(nextProps.results)!=='undefined') {
      this.setState({results: nextProps.results});
    }
    if (typeof(nextProps.statistics)!=='undefined') {
      this.setState({statistics: nextProps.statistics});
    }
  },
  render: function() {
    var classes = "btn btn-default btn-lg btn-troubleshoot"
    if (this.state.measurementRunning) {
      var buttonText = "Test running";
      classes += " disabled";
    } else {
      var buttonText = "Run test";
    }
    return (
      <div>
        <button className={classes}>{buttonText}</button><br /><br />
        <input type="text" className="measurement-interval" defaultValue="15000"></input><button className="btn-measurement-interval btn btn-default btn-xs">Countinous measurement</button><button className="btn-measurement-interval-clear btn btn-default btn-xs">Clear timeout</button>
        {/*<MeasurementDeviceComparison statistics={this.state.statistics} />
        <MeasurementGlobalComparison results={this.state.results} />
        <MeasurementRawResults results={this.state.results} />*/}
        <MeasurementWiFiResults results={this.state.results} />
      </div>
    );
  }
});

String.prototype.capitalizeFirst = function() {
  return this[0].toUpperCase() + this.substr(1);
}

ReactDOM.render(<MeasurementApp />, document.getElementById('main-div'));
// ReactDOM.render(<GraphCanvas />, document.getElementById('canvas-container'));

var setMeasurementRunning = function(measurementRunning) {
  // console.log('setMeasurementRunning was called');
  ReactDOM.render(<MeasurementApp measurementRunning={measurementRunning}/>, document.getElementById('main-div'));
};
var setResults = function(results) {
  // console.log('setResults was called');
  ReactDOM.render(<MeasurementApp results={results}/>, document.getElementById('main-div'));
};
var setStatistics = function(statistics) {
  // console.log('setStatistics was called');
  ReactDOM.render(<MeasurementApp statistics={statistics}/>, document.getElementById('main-div'));
};
var setNodes = function(nodes) {
  // console.log('setStatistics was called');
  // ReactDOM.render(<GraphCanvas nodes={nodes}/>, document.getElementById('canvas-container'));
};

module.exports = {
  setMeasurementRunning: setMeasurementRunning,
  setResults: setResults,
  setStatistics: setStatistics,
  setNodes: setNodes,
};
