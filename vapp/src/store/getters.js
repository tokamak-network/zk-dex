const getters = {
  ongoingOrders: (state) => {
    const key = state.app.metamaskAccount;
    return state.order.orders.filter(order => (order.orderMaker === key || order.orderTaker === key) && order.state < 2);
  },
  orderBook: state => state.order.orders.filter(order => order.state === '0'),
  tradeHistory: state => state.order.orders.filter(order => order.state === '2'),
};

export default getters;
