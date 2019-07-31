import pollingWeb3 from '../services/web3/pollingWeb3';

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

  SET_WALLET: (state, wallet) => {
    state.wallet = wallet;
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

  async REGISTER_WEB3 (state, web3) {
    const web3Copy = state.web3;
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];
    web3Copy.coinbase = account;
    web3Copy.networkId = await web3.eth.net.getId();
    web3Copy.balance = await web3.eth.getBalance(account);
    web3Copy.isInjected = await web3.eth.net.isListening();
    web3Copy.web3Instance = web3;

    pollingWeb3(web3);
  },
  POLL_WEB3 (state, payload) {
    state.web3.coinbase = payload.coinbase;
    state.web3.balance = payload.balance;
  },
  REGISTER_CONTRACT (state, contract) {
    state.contract = () => contract;
  },
};
