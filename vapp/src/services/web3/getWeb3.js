import Web3 from 'web3';

const getWeb3 = () =>
  new Promise(async function (resolve, reject) {
    // Modern dapp browsers...
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      try {
        await window.ethereum.enable();
      } catch (error) {
        console.log(error);
      }
    } else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
    } else {
      console.log(
        'Non-Ethereum browser detected. You should consider trying MetaMask!'
      );
    }

    console.log('web3 loaded', window.web3);
    resolve(window.web3);
  });

export default getWeb3;
