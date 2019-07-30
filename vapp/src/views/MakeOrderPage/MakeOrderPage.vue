<template>
	<div
		v-loading="loading"
		style="height: 100%; text-align: center; margin-top: 150px;"
	>
		<div style="margin-bottom: 40px;">
			<p>viewing key: {{ viewingKey }}</p>
			<p>source token type: {{ note.token }}</p>
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
			<el-button v-bind:disabled="price == ''" @click="getProof"
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
import { constants } from '../../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import { generateProof } from '../../api/index';

export default {
	data() {
		return {
			loading: false,
			price: '',
			proof: '',
		};
	},
	computed: mapState({
		coinbase: state => state.web3.coinbase,
		wallet: state => state.wallet,
		viewingKey: state => state.viewingKey,
		note: state => state.note,
		dex: state => state.dexContractInstance,
	}),
	methods: {
		getProof() {
			this.loading = true;

			const params = {
				circuit: 'makeOrder',
				params: this.note,
			};
			generateProof(params)
				.then(res => (this.proof = res.data.proof))
				.catch(e => console.log(e))
				.finally(() => (this.loading = false));
		},
		async makeOrder() {
			this.loading = true;

			await this.dex.makeOrder(
				this.viewingKey,
				this.note.token == constants.ETH_TOKEN_TYPE
					? constants.DAI_TOKEN_TYPE
					: constants.ETH_TOKEN_TYPE,
				Web3Utils.toBN(this.price),
				...this.proof,
				{
					from: this.coinbase,
				},
			);

			// TODO:
			// note status change (valid -> trading)
			// order made -> first order id is 0
			setTimeout(() => {
				this.loading = false;
				this.$router.push({ path: '/main' });
			}, 3000);
		},
	},
};
</script>
