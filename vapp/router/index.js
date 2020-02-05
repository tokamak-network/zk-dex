const express = require('express');

module.exports = (router = new express.Router()) => {
  router.use('/circuits', require('./circuits'));
  router.use('/vk', require('./vk'));
  router.use('/accounts', require('./accounts'));
  router.use('/notes', require('./notes'));
  router.use('/orders', require('./orders'));

  // Promise rejection handler
  router.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(400).json({
      message: err.message,
    });
  });

  return router;
};
