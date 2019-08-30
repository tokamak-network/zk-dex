const express = require('express');

const asyncWrap = require('../lib/asyncWrap');

const {
  getOrder,
  getOrders,
  getOrdersByUser,
  addOrder,
  addOrderByAccount,
  updateOrder,
  updateOrderByAccount,
} = require('../localstorage');

const router = express.Router();

router.get('/', asyncWrap(
  async function (req, res) {
    const orders = getOrders();
    return res.status(200).json({
      orders,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const order = req.body.order;
    addOrder(order);
    return res.status(200).json({});
  }
));

router.get('/:id', asyncWrap(
  async function (req, res) {
    const id = req.params.id;
    const order = getOrder(id);
    return res.status(200).json({
      order,
    });
  }
));

router.put('/', asyncWrap(
  async function (req, res) {
    const order = req.body.order;
    updateOrder(order);
    return res.status(200).json({});
  }
));

module.exports = router;
