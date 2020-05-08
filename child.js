'use strict';

var nconf = require('nconf');
nconf.argv().env();

var lambda;
process.on('message', function(msg) {
  if (msg.func) {

    // Just load the lambda once
    if (!lambda) {
      try {
        lambda = require('../' + msg.func);
      } catch (err) {
        process.send({ id: msg.id, code: 500, errorMessage: err.message, stack: err.stack });
        return;
      }
    }

    if (!lambda) {
      process.send({ id: msg.id, code: 500, errorMessage: 'Could not load lambda' });
      return;
    }

    var handler = lambda[msg.handler || 'handler'];
    var sent = false;

    var succeed = function (result) {
      if (!sent) {
        sent = true;
        process.send({ id: msg.id, code: 200, result: result });
      }
      return;
    };

    var fail = function (result) {
      if (!sent) {
        sent = true;
        process.send({ id: msg.id, code: 500, result: result });
      }
      return;
    };

    var promise = handler(msg.body, {
      getRemainingTimeInMillis: function () {
        return 0;
      },
      succeed: succeed,
      fail: fail
    }, function (err, result) {
      if (err) {
        fail(err);
      }
      else {
        succeed(result);
      }
    });
    if (promise) {
      promise.then(function (result) {
        succeed(result);
      }).catch(function (err) {
        fail(err);
      });
    }
  } else {
    process.send({ id: msg.id, code: 500, errorMessage: 'Could not load lambda', msg: msg });
    return;
  }
});
