'use strict';

var express = require('express'),
    http = require('http'),
    nconf = require('nconf');

nconf.argv().env();

var app = express();

app.use(require('body-parser').json({limit: '5mb', type: function () { return true; }}));

app.use(function (req, res) {
  var fn = decodeURIComponent(req.url.split('/')[3]).split('.');
  var lambda = require('../' + fn[0]);
  var handler = lambda[fn[1] || 'handler'];

  handler(req.body, {
    succeed: function (result) {
      res.status(200).json(result);
    },
    fail: function (result) {
      res.append('X-Amz-Function-Error', 'Handled');
      res.status(200).json({ errorMessage: result });
    }
  });
});

var server = http.createServer(app);
var port = nconf.get('port') || 9777;
server.listen(port, function () {
  console.log('Lambda mock server listening on port ' + port);
});
