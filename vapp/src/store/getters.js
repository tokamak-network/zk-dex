import Web3Utils from 'web3-utils';

const getters = {
  ongoingOrders: (state) => {
    const key = state.app.metamaskAccount;
    return state.order.orders.filter(order => (order.orderMaker === key || order.orderTaker === key) && parseInt(order.state, 16) < 2);
  },
  orderBook: state => state.order.orders.filter(order => order.state === '0'),
  orderHistory: (state) => {
    const key = state.app.metamaskAccount;
    return state.order.orders.filter(order => (order.orderMaker === key || order.orderTaker === key) && order.state === '2');
  },
  tradeHistory: state => state.order.orders.filter(order => order.state === '2'),
  balance: (state) => {
    let etherNoteAmount = 0;
    let daiNoteAmount = 0;
    let etherTotalBalance = Web3Utils.toBN('0x0');
    let daiTotalBalance = Web3Utils.toBN('0x0');

    state.note.notes.forEach((note) => {
      if (note.state === '0x1') {
        const token = Web3Utils.toHex(Web3Utils.toBN(note.token));
        switch (token) {
        case '0x0':
          etherNoteAmount++;
          etherTotalBalance = etherTotalBalance.add(Web3Utils.toBN(note.value));
          break;

        case '0x1':
          daiNoteAmount++;
          daiTotalBalance = daiTotalBalance.add(Web3Utils.toBN(note.value));
          break;
        }
      }
    });

    const etherNotes = {
      name: 'Ethereum',
      symbol: 'ETH',
      noteAmount: etherNoteAmount,
      totalBalance: Web3Utils.toHex(etherTotalBalance),
    };
    const daiNotes = {
      name: 'Dai',
      symbol: 'DAI',
      noteAmount: daiNoteAmount,
      totalBalance: Web3Utils.toHex(daiTotalBalance),
    };

    return [etherNotes, daiNotes];
  },
  balanceFromAccount: state => (account) => {
    let etherNoteAmount = 0;
    let daiNoteAmount = 0;
    let etherTotalBalance = Web3Utils.toBN('0x0');
    let daiTotalBalance = Web3Utils.toBN('0x0');

    state.note.notes.forEach((note) => {
      const noteOwner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(note.owner)), 40);
      if (note.state === '0x1' && account.address === noteOwner) {
        const token = Web3Utils.toHex(Web3Utils.toBN(note.token));
        switch (token) {
        case '0x0':
          etherNoteAmount++;
          etherTotalBalance = etherTotalBalance.add(Web3Utils.toBN(note.value));
          break;

        case '0x1':
          daiNoteAmount++;
          daiTotalBalance = daiTotalBalance.add(Web3Utils.toBN(note.value));
          break;
        }
      }
    });

    const etherNotes = {
      name: 'Ethereum',
      symbol: 'ETH',
      noteAmount: etherNoteAmount,
      totalBalance: Web3Utils.toHex(etherTotalBalance),
    };
    const daiNotes = {
      name: 'Dai',
      symbol: 'DAI',
      noteAmount: daiNoteAmount,
      totalBalance: Web3Utils.toHex(daiTotalBalance),
    };

    return [etherNotes, daiNotes];
  },
};

export default getters;
