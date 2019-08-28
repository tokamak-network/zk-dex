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
