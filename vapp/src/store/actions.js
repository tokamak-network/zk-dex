// import getWeb3 from '../utils/getWeb3'
import getWeb3 from '../services/web3/getWeb3';

import contract from 'truffle-contract';
import dexJSON from '../../../build/contracts/ZkDex.json';
import daiJSON from '../../../build/contracts/MockDai.json';

export default {
	setContract({ commit }) {
		const dex = contract(dexJSON);
		const dai = contract(daiJSON);

		dex.setProvider(window.web3.currentProvider);
		dai.setProvider(window.web3.currentProvider);

		commit('SET_DEX_CONTRACT', dex);
		commit('SET_DAI_CONTRACT', dai);
	},
	setDexContractInstance({ commit }, instance) {
		commit('SET_DEX_CONTRACT_INSTANCE', instance);
	},
	setDaiContractInstance({ commit }, instance) {
		commit('SET_DAI_CONTRACT_INSTANCE', instance);
	},

	setWallet({ commit }, wallet) {
		commit('SET_WALLET', wallet);
	},
	setDaiAddress({ commit }, daiAddress) {
		commit('SET_DAI_ADDRESS', daiAddress);
	},

	setViewingKey({ commit }, key) {
		commit('SET_VIEWING_KEY', key);
	},
	setSecretKey({ commit }, key) {
		commit('SET_SECRET_KEY', key);
	},

	setOrder({ commit }, order) {
		commit('SET_ORDER', order);
	},
	setOrders({ commit }, orders) {
		commit('SET_ORDERS', orders);
	},

	setNote({ commit }, note) {
		commit('SET_NOTE', note);
	},
	setMyNotes({ commit }, notes) {
		commit('SET_MY_NOTES', notes);
	},

	async registerWeb3({ commit }) {
		const web3 = await getWeb3();
		commit('REGISTER_WEB3', web3);
	},
	pollingWeb3({ commit }, payload) {
		commit('POLL_WEB3', payload);
	},
};
