<template>
	<div style="text-align: center;">
		<h2 style="margin-bottom: 40px;">ORDER BOOK</h2>
		<el-table
			:data="orders"
			highlight-current-row
			@current-change="selectOrder"
		>
			<el-table-column
				property="orderId"
				align="center"
				label="ORDER ID"
			></el-table-column>
			<el-table-column
				property="sourceToken"
				align="center"
				label="SOURCE"
			></el-table-column>
			<el-table-column
				property="targetToken"
				align="center"
				label="TARGET"
			></el-table-column>
			<el-table-column
				property="price"
				align="center"
				label="PRICE"
			></el-table-column>
		</el-table>
		<p>selected order: {{ selectedOrder }}</p>
	</div>
</template>

<script>
import { mapState, mapActions } from 'vuex';

export default {
	data() {
		return {
			orders: [],
			selectedOrder: null,
		};
	},
	computed: mapState({
		coinbase: state => state.web3.coinbase,
		contract: state => state.contractInstance(),
		web3: state => state.web3.web3Instance,
		dex: state => state.dexContractInstance,
	}),
	methods: {
		...mapActions(['setOrder', 'setOrders']),
		selectOrder(order) {
			this.selectedOrder = order;
			this.setOrder(order);
		},
		getOrder(id) {
			return this.dex.orders(id);
		},
	},
	created() {
		this.getOrder(0).then(order => {
			this.orders.push(order);
		});
	},
};
</script>
