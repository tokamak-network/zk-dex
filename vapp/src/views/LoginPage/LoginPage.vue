<template>
	<div style="text-align: center; margin-top: 120px">
		<h1>ZK-DEX</h1>
		<zk-dex-contract />
		<div style="height: 10px;"></div>
		<meta-mask />
		<div>
			<el-input
				placeholder="Enter your viewing key"
				style="width: 50%;"
				v-model="viewingKey"
				show-password
			></el-input>
		</div>
		<p>viewingKey: {{ viewingKey }}</p>
		<p>secretKey: {{ `${coinbase}${viewingKey}` }}</p>
		<div>
			<el-button
				style="margin-top: 20px;"
				v-bind:disabled="viewingKey === '' || !isInjected"
				@click="moveToMainPage"
				>START</el-button
			>
		</div>
	</div>
</template>

<script>
import MetaMask from '../../components/MetaMask';
import ZkDexContract from '../../components/ZkDexContract';

import { mapState, mapActions } from 'vuex';
import { Wallet } from '../../../../scripts/lib/Wallet';

export default {
	components: {
		MetaMask,
		ZkDexContract,
	},
	data() {
		return {
			viewingKey: '',
		};
	},
	computed: mapState({
		coinbase: state => state.web3.coinbase,
		isInjected: state => state.web3.isInjected,
		dexContractInstance: state => state.dexContractInstance,
	}),
	methods: {
		...mapActions(['setViewingKey', 'setSecretKey', 'setWallet']),
		moveToMainPage() {
			this.setKeys();
			this.initWallet().then(() => {
				this.$router.push({ path: '/main' });
			});
		},
		async initWallet() {
			const wallet = new Wallet();
			wallet.setVk(this.coinbase, this.viewingKey);
			await wallet.init(this.dexContractInstance.address);

			this.setWallet(wallet);
		},
		setKeys() {
			this.setViewingKey(this.viewingKey);
			this.setSecretKey(`${this.coinbase}${this.viewingKey}`);
		},
	},
};
</script>
