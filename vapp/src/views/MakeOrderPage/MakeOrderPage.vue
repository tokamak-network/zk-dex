<template>
	<div
		v-loading="loading"
		style="height: 100%; text-align: center; margin-top: 150px;"
	>
		<div style="margin-bottom: 40px;">
			<p>viewing key: {{ viewingKey }}</p>
			<p>target token: dai</p>
			<el-input
				type="number"
				min="0"
				style="width: 20%;"
				size="medium"
				placeholder="Enter price"
				v-model="price"
			></el-input>
			<p>price: {{ price }}</p>
		</div>
		<div style="margin-bottom: 40px;">
			<el-button v-bind:disabled="price == ''" @click="generateProof"
				>generate proof</el-button
			>
			<p>proof: {{ proof }}</p>
		</div>
		<div>
			<el-button
				v-bind:disabled="proof === '' || price == ''"
				@click="makeOrder"
				>make order</el-button
			>
		</div>
	</div>
</template>

<script>
import { mapState } from 'vuex';
import { Note, constants } from '../../../../scripts/lib/Note';
import dockerUtils from '../../../../scripts/lib/dockerUtils';
import Web3Utils from 'web3-utils';

export default {
	data() {
		return {
			price: '',
			loading: false,
			proof: '',
		};
	},
	created() {
		this.viewingKey = this.wallet.getVk(this.coinbase);
	},
	computed: mapState({
		wallet: state => state.wallet,
		dex: state => state.dexContractInstance,

		web3: state => state.web3.web3Instance,
		coinbase: state => state.web3.coinbase,
	}),
	methods: {
		generateProof() {
			this.loading = true;
			const makeNote = {}; // dummy
			dockerUtils.getMakeOrderProof(makeOrder).then(p => {
				this.proof = p;
				this.loading = false;
			});
		},
		makeOrder() {
			this.dex.makeOrder(
				this.viewingKey,
				constants.ETH_TOKEN_TYPE,
				this.price,
				...this.proof,
				{ from: this.coinbase },
			);
		},
	},
};
</script>
