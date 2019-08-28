const getters = {
  isListening: state => state.web3.isListening,
  numberOfNotesInAccount: state => (account) => {
    let count = 0;
    if (state.notes !== null) {
      for (let i = 0; i < state.notes.length; i++) {
        if (state.notes[i].owner === account.address) {
          count++;
        }
      }
    }
    return count;
  },
  orderList: (state) => {
    const list = {};
    if (state.orders !== null && typeof state.orders !== 'undefined') {
      state.orders.forEach((o) => {
        // only valid order
        if (o.state === '0x0') {
          list[o.price] = (list[o.price] || 0) + 1;
        }
      });
    }
    return list;
  },
  smartNotes: (state) => {
    if (state.notes !== null && typeof state.notes !== 'undefined') {
      return state.notes.filter(note => note.isSmart === '0x1');
    }
    return [];
  },
  ongoingOrderHistory: (state) => {
    if (state.orderHistory !== null) {
      return state.orderHistory.filter(order => parseInt(order.state) <= 1);
    }
    return [];
  },
  completedOrderHistory: (state) => {
    if (state.orderHistory !== null) {
      return state.orderHistory.filter(order => parseInt(order.state) > 1);
    }
    return [];
  },
};

export default getters;
