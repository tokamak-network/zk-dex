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
      <div
        class="button-container"
        @click="makeOrder"
      >
        <standard-button
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
      <div
        class="button-container"
        @click="takeOrder"
      >
        <standard-button
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
import { createNote } from '../../../../helpers/note';

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
  computed: mapState({
    dexContract: state => state.app.dexContract,
    metamaskAccount: state => state.app.metamaskAccount,
  }),
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
        this.clearInputText();
      }
      this.whichRadioButtonClicked = radioButton;
    },
    clearInputText () {
      this.orderId = '',
      this.price = '',
      this.noteHash = '';
      this.noteAmount = '';
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

      // 1. update note state
      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[0].args.state);
        this.makerNote.hash = noteHash;
        this.makerNote.state = noteState;
        this.$store.dispatch(
          'updateNote',
          (await api.updateNote(this.metamaskAccount, this.makerNote))
        );
      } catch (err) {
        console.log(err); // TODO: error handling.
      }

      // 2. create order
      const orderId = Web3Utils.toHex((await this.dexContract.getOrderCount()) - 1);
      const order = await this.dexContract.orders(orderId);
      order.orderId = orderId;
      order.orderMaker = this.metamaskAccount;
      order.makerNoteObject = this.makerNote; // TODO: makerNoteObject -> makerNote, makerNote -> makerNoteHash
      order.makerNoteValue = this.makerNote.value;

      try {
        this.$store.dispatch('addOrder', (await api.addOrder(order)));
      } catch (err) {
        console.log(err);
      } finally {
        this.clearInputText();
        this.waitingForMakingOrder = false;
      }
    },
    async takeOrder () {
      this.waitingForTakingOrder = true;
      // get note.
      const makerNoteHash = this.order.makerNote;
      const takerNote = this.takerNote;
      const stakeNote = createNote(makerNoteHash, takerNote.value, this.order.targetToken, true);

      // generate proof.
      const circuit = 'takeOrder';
      const params = [makerNoteHash, takerNote, stakeNote];
      const proof = (await api.generateProof(circuit, params)).data.proof;

      // validate proof and take order.
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

      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[0].args.state);
        this.takerNote.hash = noteHash;
        this.takerNote.state = noteState;
        this.$store.dispatch(
          'updateNote',
          (await api.updateNote(this.metamaskAccount, this.takerNote))
        );
      } catch (err) {
        console.log(err); // TODO: error handling.
      }

      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[1].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[1].args.state);
        stakeNote.hash = noteHash;
        stakeNote.state = noteState;
        await api.addNote(this.order.orderMaker, stakeNote);
      } catch (err) {
        console.log(err); // TODO: error handling.
      }

      const orderId = Web3Utils.toHex(tx.logs[2].args.orderId);
      const order = await this.dexContract.orders(orderId);
      Object.keys(order).forEach((key) => {
        this.order[key] = order[key];
      });
      this.order.orderTaker = this.metamaskAccount;
      this.order.takerNoteValue = this.takerNote.value;
      this.order.takerNoteObject = takerNote;
      this.order.stakeNoteObject = stakeNote;

      this.$store.dispatch(
        'updateOrder',
        (await api.updateOrder(this.order))
      );
      this.clearInputText();
      this.waitingForTakingOrder = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "TradeContainer.scss";
</style>
