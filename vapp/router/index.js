const express = require('express');

module.exports = (router = new express.Router()) => {
  router.use('/circuits', require('./circuits'));
  router.use('/vk', require('./vk'));
  router.use('/accounts', require('./accounts'));
  router.use('/notes', require('./notes'));
  router.use('/orders', require('./orders'));

  return router;
};
