export default {
  SET_DEX_CONTRACT: (state, contract) => {
    state.dexContract = contract;
  },
  SET_DAI_CONTRACT: (state, contract) => {
    state.daiContract = contract;
  },
  SET_DEX_CONTRACT_INSTANCE: (state, contractInstance) => {
    state.dexContractInstance = contractInstance;
  },
  SET_DAI_CONTRACT_INSTANCE: (state, contractInstance) => {
    state.daiContractInstance = contractInstance;
  },

  SET_DAI_ADDRESS: (state, daiAddress) => {
    state.daiAddress = daiAddress;
  },

  SET_VIEWING_KEY: (state, key) => {
    state.viewingKey = key;
  },
  SET_SECRET_KEY: (state, key) => {
    state.secretKey = key;
  },
  SET_ORDER: (state, order) => {
    state.order = order;
  },

  SET_NOTE: (state, note) => {
    state.note = note;
  },
  SET_MY_NOTES: (state, notes) => {
    state.myNotes = notes;
  },

  SET_WEB3: (state, web3) => {
    state.web3 = web3;
  },

  UPDATE_WALLET (state, account) {
    state.web3.coinbase = account.coinbase;
    state.web3.balance = account.balance;
  },

  REGISTER_CONTRACT (state, contract) {
    state.contract = () => contract;
  },

  SET_LAST_PATH (state, path) {
    state.path = path;
  },

  SET_KEY (state, key) {
    state.key = key;
  },

  SET_ACCOUNT (state, account) {
    state.account = account;
  },

  MUTATE_ACCOUNTS (state, accounts) {
    state.accounts = accounts;
  },

  SET_ACCOUNTS (state, accounts) {
    state.accounts = accounts;
  },
  ADD_ACCOUNT (state, account) {
    if (state.accounts === null) {
      state.accounts = [];
    }
    state.accounts.push(account);
  },
  DELETE_ACCOUNT (state, account) {
    const i = state.accounts.indexOf(account);
    state.accounts.splice(i, 1);
  },
  SET_NOTES (state, notes) {
    state.notes = notes;
  },
  ADD_NOTE (state, note) {
    console.log('add note', note);
    if (state.notes === null) {
      state.notes = [];
    }
    state.notes.push(note);
    console.log('inadd', state.notes);
  },
  UPDATE_NOTE_STATE: (state, n) => {
    console.log('inupdate', state.notes);
    // const { noteHash, noteState } = n;
    // console.log('test', noteHash, noteState);
    for (let i = 0; i < state.notes.length; i++) {
      console.log('update note', state.notes[i]);
      // if (state.notes[i].hash === noteHash) {
      //   const note = state.notes[i];
      //   note.hash = noteHash;
      //   note.state = noteState;
      //   state.notes.splice(i, 1, note);
      //   console.log('after', state.notes);
      //   break;
      // }
    }
  },
  SET_TRANSFER_NOTES (state, transferNotes) {
    state.transferNotes = transferNotes;
  },
  SET_ORDERS: (state, orders) => {
    state.orders = orders;
  },
  ADD_ORDER: (state, order) => {
    if (state.orders === null) {
      state.orders = [];
    }
    state.orders.push(order);
  },
  SET_ORDER_HISTORY: (state, history) => {
    state.orderHistory = history;
  },
  ADD_ORDER_HISTORY: (state, history) => {
    if (state.orderHistory === null) {
      state.orderHistory = [];
    }
    state.orderHistory.push(history);
  },
};
