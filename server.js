'use strict';

var express = require('express'),
    http = require('http'),
    nconf = require('nconf');

nconf.argv().env();

var app = express();

app.use(require('body-parser').json({limit: '5mb', type: function () { return true; }}));

app.use(function (req, res) {
  var fn = decodeURIComponent(req.url.split('/')[3]).split('.');
  var name = fn[0].replace('/build/package', '');
  var lambda;
  try {
    lambda = require('../' + fn[0]);
  } catch (err) {
    console.log(name + ': [error]   ' + (req.url) + ' ' + err.message);
  }

  if (!lambda) {
    return res.status(500).json({ errorMessage: 'Could not load lambda' });
  }

  var handler = lambda[fn[1] || 'handler'];

  console.log(name + ': [start]   ' + (req.body.requestType || '') + ' ' + (req.body.type || 'Unknown mime'));
  var sent = false;
  handler(req.body, {
    succeed: function (result) {
      if (!sent) {
        console.log(name + ': [succeed]   ' + (req.body.requestType || '') + ' ' + (req.body.type || 'Unknown mime'));
        res.status(200).json(result);
      } else {
        console.log(name + ': [dup]   ' + (req.body.requestType || '') + ' ' + (req.body.type || 'Unknown mime'));
      }
      sent = true;
    },
    fail: function (result) {
      if (!sent) {
        console.log(name + ': [fail]   ' + (req.body.requestType || '') + ' ' + (req.body.type || 'Unknown mime'));
        res.append('X-Amz-Function-Error', 'Handled');
        res.status(200).json({ errorMessage: result });
      } else {
        console.log(name + ': [dup]   ' + (req.body.requestType || '') + ' ' + (req.body.type || 'Unknown mime'));
      }
      sent = true;
    }
  });
});

var server = http.createServer(app);
var port = nconf.get('port') || 9777;
server.listen(port, function () {
  console.log('Lambda mock server listening on port ' + port);
});
