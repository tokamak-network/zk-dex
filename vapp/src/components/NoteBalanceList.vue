<template>
  <div class="box" style="text-align: center;">
    <div style="float: left;">
      <p style="margin-left: 10px;">Total Balance</p>
    </div>
    <div style="float: right;" v-if="$route.path === '/combine'">
      <section>
        <b-select placeholder="Select Account" v-model="selectedAccount">
          <option v-for="account in accounts">
            {{ account.address }} {{ account.name }}
          </option>
        </b-select>
      </section>
    </div>
    <table class="table fixed_header" style="margin-top: 80px;">
      <thead>
        <tr>
          <th>Currency Name</th>
          <th>Symbol</th>
          <th>Total Notes</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="token in tokens">
          <td>{{ token.name }}</td>
          <td>{{ token.symbol }}</td>
          <td>{{ totalNotes(token.type) }}</td>
          <td>
            <router-link :to="{ path: 'note', query: { action: 'mint', token: token.symbol } }" tag="button" class="button is-small">Create</router-link>
            <router-link :to="{ path: 'note', query: { action: 'liquidate', token: token.symbol } }" tag="button" class="button is-small" style="margin-left: 5px;">Liquidate</router-link>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import Web3Utils from 'web3-utils';

export default {
  data () {
    return {
      tokens: [
        {
          type: '0',
          name: 'Ethereum',
          symbol: 'ETH',
          totalNotes: 0,
        },
        {
          type: '1',
          name: 'Dai',
          symbol: 'DAI',
          totalNotes: 0,
        },
        {
          type: '2',
          name: 'Tokamak Network',
          symbol: 'TON',
          totalNotes: 0,
        },
      ],
      selectedAccount: null,
    };
  },
  props: ['accounts', 'notes'],
  created () {
    for (const note of this.notes) {
      const token = Web3Utils.hexToNumberString(note.token);
      if (token === '0') {
        this.tokens[0].totalNotes++;
      } else if (token === '1') {
        this.tokens[1].totalNotes++;
      } else if (token === '2') {
        this.tokens[2].totalNotes++;
      }
    }
  },
  computed: {
    totalNotes () {
      return (type) => {
        const f = this.notes.filter((n) => {
          const t = Web3Utils.hexToNumberString(n.token);
          return t === type;
        });
        return f.length;
      };
    },
  },
  watch: {
    selectedAccount (newAccount) {
      this.$emit('selectAccount', newAccount);
    },
  },
  methods: {
    // filterNoteByAccount () {
    //   if (this.selectedAccount !== '') {
    //     this.notes = this.notes.filter((note) => {
    //       const noteOwner = Web3Utils.padLeft(
    //         Web3Utils.toHex(Web3Utils.toBN(note.owner)),
    //         20
    //       );
    //       return noteOwner === this.selectedAccount;
    //     });
    //   } else {
    //     this.notes = [];
    //   }
    // },
  },
};
</script>
