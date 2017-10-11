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
    handler(msg.body, {
      succeed: function (result) {
        if (!sent) {
          sent = true;
          process.send({ id: msg.id, code: 200, result: result });
        }
        return;
      },
      fail: function (result) {
        if (!sent) {
          sent = true;
          process.send({ id: msg.id, code: 500, result: result });
        }
        return;
      }
    });
  } else {
    process.send({ id: msg.id, code: 500, errorMessage: 'Could not load lambda', msg: msg });
    return;
  }
});
