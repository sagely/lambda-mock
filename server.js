'use strict';

var express = require('express'),
    http = require('http'),
    nconf = require('nconf');
var childProcess = require('child_process');

nconf.argv().env();

var app = express();

app.use(require('body-parser').json({limit: '5mb', type: function () { return true; }}));

var child = {};
var finished = {};

app.use(function (req, res) {
  var fn = decodeURIComponent(req.url.split('/')[3]).split('.');
  var name = fn[0].replace('/build/package', '');

  // Only create a child once, just keep using it
  if (!child[fn[0]] || !child[fn[0]].connected || child[fn[0]].killed) {
    console.log(name +': [loading]');
    child[fn[0]] = childProcess.fork("./child.js");
    child[fn[0]].on('message', function (msg) {
      if (finished[fn[0]][msg.id]) {
        console.log(name + ': [dup]     Response already sent.');
        return;
      }
      finished[fn[0]][msg.id] = true;

      if (!child[fn[0]][msg.id].req || !child[fn[0]][msg.id].res) {
        console.log(name + ': [error]   req or res not valid. (' + msg.errorMessage + ')');
        return;
      }

      if (msg.code === 500 && !msg.result) {
        console.log(name + ': [error A]   ' + (child[fn[0]][msg.id].req.url) + ' ' + msg.errorMessage);
        console.log(msg.stack);
        child[fn[0]][msg.id].res.status(500).json({ errorMessage: 'Could not load lambda' });
      } else if (msg.code === 500) {
        var err;
        try {
          err = JSON.parse(msg.result);
        } catch (e) { }
        if (err && err.message) {
          console.log(name + ': [fail]   ' + (child[fn[0]][msg.id].req.body.requestType || '') + ' ' + (child[fn[0]][msg.id].req.body.type || 'Unknown mime') + ' (' + err.message + ')');
        } else {
          console.log(name + ': [fail]   ' + (child[fn[0]][msg.id].req.body.requestType || '') + ' ' + (child[fn[0]][msg.id].req.body.type || 'Unknown mime') + ' (' + msg + ')');
        }
        child[fn[0]][msg.id].res.append('X-Amz-Function-Error', 'Handled');
        child[fn[0]][msg.id].res.status(200).json({ errorMessage: msg.result });
      } else if (msg.result) {
        console.log(name + ': [succeed]   ' + (child[fn[0]][msg.id].req.body.requestType || '') + ' ' + (child[fn[0]][msg.id].req.body.type || 'Unknown mime'));
        child[fn[0]][msg.id].res.status(200).json(msg.result);
      } else {
        console.log(name + ': [error B]   ' + (child[fn[0]][msg.id].req.url) + ' ', msg);
        child[fn[0]][msg.id].res.status(500).json({ errorMessage: 'Bad Fork' });
      }
      delete child[fn[0]][msg.id].res;
      delete child[fn[0]][msg.id].req;
    });
  }

  // Call the child process to do our work
  var id = Math.floor((Math.random() * 100000) + 1);
  if (!finished[fn[0]]) {
    finished[fn[0]] = {};
  }
  finished[fn[0]][id] = false;

  child[fn[0]][id] = {
    res: res,
    req: req
  };
  child[fn[0]].send({
    id: id,
    func: fn[0],
    handler: fn[1] || 'handler',
    body: req.body
  });
});

var server = http.createServer(app);
var port = nconf.get('port') || 9777;
server.listen(port, function () {
  console.log('Lambda mock server listening on port ' + port);
});


var stdin = process.openStdin();
process.stdin.setRawMode = true;
stdin.resume();

stdin.on( 'data', function( key ){
  // ctrl-c
  if ( key === '\u0003' ) {
    process.exit();
  } else {

    console.log('Resetting...');
    Object.keys(child).map(function (key) {
      child[key].disconnect();
    });
  }
});
