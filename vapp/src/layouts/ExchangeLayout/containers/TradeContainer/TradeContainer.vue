<template>
  <div class="container">
    <!-- TODO: all png logo must be 24px , 24px -->
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/trade.png" />
      <h3>Trade</h3>
      <radio-button
        leftTitle="Make"
        rightTitle="Take"
        v-on:radioButtonClicked="radioButtonClicked"
      />
    </div>
    <div class="input-text-container"
      v-if="whichRadioButtonClicked == 'left'">
      <input-text
        :label="'Price (DAI)'"
        :isStaticValue="false"
      >
        <template v-slot:input>
          <input type="text"
            v-model="price"
          />
        </template>
      </input-text>
      <input-text
        :label="'Note'"
        :isStaticValue="true"
        :value="noteHash"
      />
      <input-text
        :label="'Note Amount'"
        :value="noteAmount"
        :isStaticValue="true"
      />
      <div class="button-container">
        <standard-button
          @click.native="makeOrder"
          :text="'Make Order'"
          :loading="waitingForMakingOrder"
        />
      </div>
    </div>
    <div class="input-text-container"
      v-else-if="whichRadioButtonClicked == 'right'">
      <input-text
        :label="'Order ID'"
        :isStaticValue="true"
        :value="orderId"
      />
      <input-text
        :label="'Price'"
        :isStaticValue="true"
        :value="price"
      />
      <input-text style="margin-top: 16px;"
        :label="'Note'"
        :isStaticValue="true"
        :value="noteHash"
      />
      <input-text
        :label="'Note Amount'"
        :isStaticValue="true"
        :value="noteAmount"
      />
      <div class="button-container">
        <standard-button
          @click.native="takeOrder"
          :text="'Take Order'"
          :loading="waitingForTakingOrder"
        />
      </div>
    </div>
  </div>
</template>

<script>
import InputText from '../../../../components/Inputs/InputText';
import RadioButton from '../../../../components/RadioButton';
import StandardButton from '../../../../components/StandardButton';

import { mapState } from 'vuex';
import api from '../../../../api/index';
import Web3Utils from 'web3-utils';

export default {
  data () {
    return {
      whichRadioButtonClicked: 'left',
      makerNote: {},
      takerNote: {},
      order: {},
      orderId: '',
      price: '',
      noteHash: '',
      noteAmount: '',
      waitingForMakingOrder: false,
      waitingForTakingOrder: false,
    };
  },
  computed: {
    ...mapState([
      'userKey',
      'metamaskAccount',
      'dexContract',
    ]),
  },
  components: {
    InputText,
    RadioButton,
    StandardButton,
  },
  created () {
    this.$bus.$on('noteSelected', (note) => {
      this.makerNote = note;
      this.takerNote = note;
      this.noteHash = note.hash;
      this.noteAmount = note.value; // TODO: value -> amount.
    });
    this.$bus.$on('orderSelected', (order) => {
      this.order = order;
      this.orderId = order.orderId;
      if (this.whichRadioButtonClicked !== 'left') {
        this.price = order.price;
      }
    });
  },
  beforeDestroy () {
    this.$bus.$off(['noteSelected', 'orderSelected'], () => {});
  },
  methods: {
    radioButtonClicked (radioButton) {
      if (this.whichRadioButtonClicked !== radioButton) {
        this.clear();
      }
      this.whichRadioButtonClicked = radioButton;
    },
    clear () {
      this.orderId = '',
      this.price = '',
      this.noteHash = '';
      this.noteAmount = '';
      this.waitingForTakingOrder = false;
      this.waitingForTakingOrder = false;
    },
    async makeOrder () {
      if (this.waitingForMakingOrder === true) return;
      this.waitingForMakingOrder = true;

      // generate proof.
      const circuit = 'makeOrder';
      const params = [this.makerNote];
      const proof = (await api.generateProof(circuit, params)).data.proof;

      // validate proof and make order.
      const tokenType = parseInt(this.makerNote.token);
      const wantToBuyTokenType = tokenType === 0 ? 1 : 0;
      const tx = await this.dexContract.makeOrder(
        '0x0',
        wantToBuyTokenType,
        this.price,
        ...proof,
        {
          from: this.metamaskAccount,
        }
      );

      if (!tx.receipt.status) {
        alert('revert transaction');
        return;
      }

      await new Promise(r => setTimeout(r, 5000));

      const notes = await api.getNotes(this.userKey);
      const orders = await api.getOrders();
      const ordersByUser = await api.getOrdersByUser(this.userKey);

      this.$store.dispatch('setNotes', notes);
      this.$store.dispatch('setOrders', orders);
      this.$store.dispatch('setOrdersByUser', ordersByUser);

      this.clear();
    },
    async takeOrder () {
      if (this.waitingForTakingOrder === true) return;
      this.waitingForTakingOrder = true;

      const makerNoteHash = this.order.makerNote;
      const takerNote = this.takerNote;
      const stakeNote = {};
      // const stakeNote = createNote(makerNoteHash, takerNote.value, this.order.targetToken, true);

      const circuit = 'takeOrder';
      const params = [makerNoteHash, takerNote, stakeNote];
      const proof = (await api.generateProof(circuit, params)).data.proof;

      const tx = await this.dexContract.takeOrder(
        Web3Utils.toHex(this.orderId),
        ...proof,
        stakeNote.encrypt(this.order.makerViewingKey),
        {
          from: this.metamaskAccount,
        }
      );

      if (!tx.receipt.status) {
        alert('revert transaction');
        return;
      }

      await new Promise(r => setTimeout(r, 5000));

      const notes = await api.getNotes(this.userKey);
      const orders = await api.getOrders();
      const ordersByUser = await api.getOrdersByUser(this.userKey);

      this.$store.dispatch('setNotes', notes);
      this.$store.dispatch('setOrders', orders);
      this.$store.dispatch('setOrdersByUser', ordersByUser);

      this.clear();
    },
  },
};
</script>

<style lang="scss" scoped>
@import "TradeContainer.scss";
</style>
