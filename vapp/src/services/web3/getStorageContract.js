import Web3 from 'web3'
import { address, ABI } from './constants/storageContract.js'

const getStorageContract = new Promise(function (resolve) {
  const web3 = new Web3(window.web3.currentProvider)
  const storageContract = new web3.eth.Contract(ABI, address)
  resolve(storageContract)
})

export default getStorageContract