<template>
	<div
		v-loading="loading"
		style="height: 100%; text-align: center; margin-top: 150px;"
	>
		<div>
			<el-button @click="generateProof">generate proof</el-button>
		</div>
		<div>
			<p>proof: {{ proof }}</p>
			<p>
				order id:
				d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35
			</p>
			<p>
				maker note:
				4fc82b26aecb47d2868c4efbe3581732a3e7cbcc6c2efb32062c08170a05eeb8
			</p>
			<p>
				taker note:
				6b51d431df5d7f141cbececcf79edf3dd861c3b4069f0b11661a3eefacbba918
			</p>
			<p>
				payment note:
				3fdba35f04dc8c462986c992bcf875546257113072a909c162f7e470e581e278
			</p>
			<p>
				change note:
				8527a891e224136950ff32ca212b45bc93f69fbb801c3b1ebedac52775f99e61
			</p>
			<p>price: 13</p>
		</div>
		<div>
			<el-button v-bind:disabled="proof === ''" @click="settleOrder"
				>settle order</el-button
			>
		</div>
	</div>
</template>

<script>
import rlp from 'rlp';
import { mapState } from 'vuex';
import { Note, constants } from '../../../../scripts/lib/Note';
import dockerUtils from '../../../../scripts/lib/dockerUtils';

export default {
	data() {
		return {
			price: '',
			loading: false,
			proof: '',
			rewardNote: null,
			paymentNote: null,
			changeNote: null,
		};
	},
	computed: mapState({
		orders: state => state.orders,
		myNotes: state => state.myNotes,
		viewingKey: state => state.viewingKey,
		secretKey: state => state.secretKey,
		dex: state => state.dexContractInstance,

		web3: state => state.web3.web3Instance,
		coinbase: state => state.web3.coinbase,
	}),
	methods: {
		makeNotesForSettle() {
			this.rewardNote = new Note(
				takerNote.hash(),
				makerNote.value,
				constants.DAI_TOKEN_TYPE,
				takerVk,
				web3Utils.randomHex(16),
				true,
			);
			this.paymentNote = new Note(
				makerNote.hash(),
				takerNote.value,
				constants.ETH_TOKEN_TYPE,
				takerVk,
				web3Utils.randomHex(16),
				true,
			);
			this.changeNote = new Note(
				makerNote.hash(),
				ether('0'),
				constants.ETH_TOKEN_TYPE,
				makerVk,
				web3Utils.randomHex(16),
				true,
			);
		},
		generateProof() {
			this.loading = true;
			dockerUtils
				.getSettleOrderProof(
					makerNote,
					stakeNote,
					this.rewardNote,
					this.paymentNote,
					this.changeNote,
					this.price,
				)
				.then(p => {
					this.proof = p;
					this.loading = false;
				});
		},
		settleOrder() {
			const e = rlp.encode([
				this.rewardNote.encrypt(),
				this.paymentNote.encrypt(),
				this.changeNote.encrypt(),
			]);
			this.dex.settleOrder(orderId, ...this.proof, e, { from: this.coinbase });
		},
	},
};
</script>
