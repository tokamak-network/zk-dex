const express = require('express');
const asyncWrap = require('../lib/asyncWrap');
const localStorage = require('../localstorage');

const router = express.Router();

router.get('/', asyncWrap(
  async function (req, res) {
    const orders = localStorage.getOrders();
    return res.status(200).json({
      orders,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const order = req.body.order;
    localStorage.addOrder(order);

    return res.status(200).json({
      order,
    });
  }
));

router.put('/', asyncWrap(
  async function (req, res) {
    const orderId = req.body.orderId;
    const order = req.body.order;
    const updatedOrder = localStorage.updateOrder(orderId, order);

    return res.status(200).json({
      order: updatedOrder,
    });
  }
));

module.exports = router;
