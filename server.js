'use strict';

var express = require('express'),
    http = require('http'),
    nconf = require('nconf');

nconf.argv().env();

var app = express();

app.use(require('body-parser').json({limit: '5mb', type: function () { return true; }}));

app.use(function (req, res) {
  try {
    var fn = decodeURIComponent(req.url.split('/')[3]).split('.');
    var lambda = require('../' + fn[0]);
    var handler = lambda[fn[1] || 'handler'];

    console.log(fn[0] + ': [start]');
    handler(req.body, {
      succeed: function (result) {
        console.log(fn[0] + ': [succeed]');
        res.status(200).json(result);
      },
      fail: function (result) {
        console.log(fn[0] + ': [fail]');
        try {
          res.append('X-Amz-Function-Error', 'Handled');
          res.status(200).json({ errorMessage: result });
        } catch (e) {
          console.log('exception sending result', e);
        }
      }
    });
  } catch (e) {
    res.append('X-Amz-Function-Error', 'Unhandled');
    res.status(200).json({ errorMessage: e.message + '\n' + e.stack });
  }
});

var server = http.createServer(app);
var port = nconf.get('port') || 9777;
server.listen(port, function () {
  console.log('Lambda mock server listening on port ' + port);
});
