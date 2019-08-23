const getters = {
  account: state => state.account,
  accounts: state => state.accounts,
  note: state => state.note,
  order: state => state.order,
  isListening: state => state.web3.isListening,
};

export default getters;
