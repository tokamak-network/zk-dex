const express = require('express');

const asyncWrap = require('../lib/asyncWrap');

const {
  getOrder,
  getOrders,
  getOrdersByAccount,
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

router.get('/:id', asyncWrap(
  async function (req, res) {
    const id = req.params.id;
    const order = getOrder(id);
    return res.status(200).json({
      order,
    });
  }
));

router.get('/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const orders = getOrdersByAccount(account);
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

router.post('/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const order = req.body.order;
    addOrderByAccount(account, order);
    return res.status(200).json({});
  }
));


router.put('/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const order = req.body.order;
    updateOrderByAccount(account, order);
    return res.status(200).json({});
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
