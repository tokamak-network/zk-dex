<template>
	<div style="text-align: center;">
		<h2 style="margin-bottom: 40px;">MY NOTES</h2>
		<el-table
			:data="notes"
			highlight-current-row
			@current-change="selectNote"
			style="width: 100%"
		>
			<el-table-column
				property="token"
				label="TOKEN"
				align="center"
			></el-table-column>
			<el-table-column
				property="value"
				label="VALUE"
				align="center"
			></el-table-column>
			<el-table-column align="right">
				<template slot-scope="scope">
					<div v-if="scope.row.status === 'trading'">
						<el-button
							size="mini"
							@click="handleNoteToSettleOrder(scope.$index, scope.row)"
							>settle order</el-button
						>
					</div>
					<div v-else>
						<el-button
							style="margin-bottom: 10px;"
							size="mini"
							@click="handleNoteToMakeOrder(scope.$index, scope.row)"
							>make order</el-button
						>
						<el-button
							size="mini"
							@click="handleNoteToTakeOrder(scope.$index, scope.row)"
							>take order</el-button
						>
					</div>
				</template>
			</el-table-column>
		</el-table>
		<p>selected note: {{ selectedNote }}</p>
	</div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { constants } from '../../../../scripts/lib/Note';

export default {
	data() {
		return {
			notes: [],
			selectedNote: null,
		};
	},
	computed: mapState({
		coinbase: state => state.web3.coinbase,
		wallet: state => state.wallet,
	}),
	methods: {
		...mapActions(['setNote', 'setMyNotes']),
		selectNote(note) {
			this.selectedNote = note;
		},
		mappedNotes(notes) {
			return notes.map(note => {
				const n = {};
				n.token = note.token == constants.ETH_TOKEN_TYPE ? 'eth' : 'dai';
				n.value = parseInt(note.value);

				return n;
			});
		},
		handleNoteToMakeOrder(index, note) {
			this.setNote(this.notes[index]);
			this.$router.push({ path: '/make' });
		},
		handleNoteToTakeOrder(index, note) {
			this.setNote(this.notes[index]);
			this.$router.push({ path: '/take' });
		},
		handleNoteToSettleOrder(index, note) {
			this.setNote(this.notes[index]);
			this.$router.push({ path: '/settle' });
		},
	},
	created() {
		this.notes = this.wallet.getNotes(this.coinbase);
		// this.notes = this.mappedNotes(notes);
	},
};
</script>
