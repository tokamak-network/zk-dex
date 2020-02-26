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
      <!-- <input-text
        :label="'Order ID'"
        :isStaticValue="true"
        :value="orderId"
      /> -->
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
import { Note } from '../../../../../../scripts/lib/Note';

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
      makerZkAddress: '',
      takerZkAddress: '',
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
      this.noteHash = this.$options.filters.toNoteHash(note);
      this.noteAmount = note.value; // TODO: value -> amount.
      this.makerZkAddress = this.$options.filters.toZkAddress(note.pubKey0, note.pubKey1);
      this.takerZkAddress = this.$options.filters.toZkAddress(note.pubKey0, note.pubKey1);
    });
    this.$bus.$on('orderSelected', (orderBook) => {
      this.order = orderBook.orders[0];
      if (this.whichRadioButtonClicked !== 'left') {
        this.price = this.order.price;
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
      this.waitingForMakingOrder = false;
      this.waitingForTakingOrder = false;
    },
    async unlockAccount (address, passphrase = '1234') {
      try {
        await api.unlockAccount(this.userKey, passphrase, address);
      } catch (e) {
        console.log('failed to unlock');
      }
    },
    async makeOrder () {
      if (this.waitingForMakingOrder === true) return;
      this.waitingForMakingOrder = true;

      // TODO: check unlock or not.
      await this.unlockAccount(this.makerZkAddress);

      console.log('generating proof...');
      const proof = (await api.generateProof('/makeOrder', [this.makerNote], [{
        userKey: this.userKey,
        address: this.makerZkAddress,
      }])).data.proof;

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

      // TODO: fix
      await new Promise(r => setTimeout(r, 1500));

      await this.$store.dispatch('set', ['notes', 'orders', 'ordersByUser']);
      this.clear();
    },
    async takeOrder () {
      if (this.waitingForTakingOrder === true) return;
      this.waitingForTakingOrder = true;

      const viewingKey = '1234';
      const getSalt = () => Web3Utils.randomHex(16);

      const makerNote = new Note(...Object.values(this.order.makerInfo.makerNote));
      const takerNote = new Note(...Object.values(this.takerNote));
      const stakeNote = Note.createSmartNote(this.order.makerNote, takerNote.value, this.order.targetToken, viewingKey, getSalt());

      // TODO: delete note if tx failed.
      await api.addNote(this.order.makerInfo.makerUserKey, stakeNote);

      // TODO: check unlock or not.
      await this.unlockAccount(this.makerZkAddress);

      const proof = (await api.generateProof('/takeOrder', [
        takerNote,
        stakeNote,
      ], [{
        userKey: this.userKey,
        address: this.takerZkAddress,
      }])).data.proof;

      const tx = await this.dexContract.takeOrder(
        Web3Utils.toHex(this.order.orderId),
        ...proof,
        stakeNote.encrypt(this.order.makerViewingKey),
        {
          from: this.metamaskAccount,
        }
      );

      await new Promise(r => setTimeout(r, 1500));

      await this.$store.dispatch('set', ['notes', 'orders', 'ordersByUser']);
      this.clear();
    },
  },
};
</script>

<style lang="scss" scoped>
@import "TradeContainer.scss";
</style>
00
