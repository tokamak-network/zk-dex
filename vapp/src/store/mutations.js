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
  SET_ORDERS: (state, orders) => {
    state.orders = orders;
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
  ADD_ACCOUHNT (state, account) {
    state.accounts.push(account);
  },
};
