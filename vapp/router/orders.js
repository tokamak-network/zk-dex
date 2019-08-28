const express = require('express');

const asyncWrap = require('../lib/asyncWrap');

const {
  getOrder,
  getOrders,
  getOrderHistory,
  addOrder,
  addOrderHistory,
  updateOrderHistoryState,
  updateOrderState,
  updateOrderTaker,
  updateOrderHistory,
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

// TODO: fix duplicate ('/:account') path
router.get('/:id', asyncWrap(
  async function (req, res) {
    const id = req.params.id;
    const order = getOrder(id);
    return res.status(200).json({
      order,
    });
  }
));

router.get('/history/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const orders = getOrderHistory(account);
    return res.status(200).json({
      orders,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const order = req.body.order;
    const orders = addOrder(order);
    return res.status(200).json({
      orders,
    });
  }
));

router.post('/history/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const orderHistory = req.body.history;
    const history = addOrderHistory(account, orderHistory);
    return res.status(200).json({
      history,
    });
  }
));


router.put('/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const order = req.body.order;
    const orders = updateOrderHistory(account, order);
    return res.status(200).json({
      orders,
    });
  }
));

router.put('/', asyncWrap(
  async function (req, res) {
    const orderId = req.body.orderId;
    const orderState = req.body.orderState;
    const orders = updateOrderState(orderId, orderState);
    return res.status(200).json({
      orders,
    });
  }
));

router.put('/taker', asyncWrap(
  async function (req, res) {
    const orderId = req.body.orderId;
    const orderTaker = req.body.orderTaker;
    const orders = updateOrderTaker(orderId, orderTaker);
    return res.status(200).json({
      orders,
    });
  }
));

router.put('/state/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const orderId = req.body.orderId;
    const orderState = req.body.orderState;
    const history = updateOrderHistoryState(account, orderId, orderState);
    return res.status(200).json({
      history,
    });
  }
));

module.exports = router;
