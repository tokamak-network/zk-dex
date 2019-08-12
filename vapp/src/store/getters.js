const getters = {
  note: state => state.note,
  order: state => state.order,
  accounts: state => state.accounts,
  isListening: state => state.web3.isListening,
};

export default getters;
