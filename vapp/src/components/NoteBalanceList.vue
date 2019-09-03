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
    <table class="table" style="margin-top: 40px;">
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
          <td v-if="$route.path === '/'">
            <router-link :to="{ path: 'notes', query: { action: 'mint', token: token.symbol } }" tag="button" class="button is-small">Create</router-link>
            <router-link :to="{ path: 'notes', query: { action: 'liquidate', token: token.symbol } }" tag="button" class="button is-small" style="margin-left: 5px;">Liquidate</router-link>
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
      ],
      selectedAccount: null,
    };
  },
  props: ['accounts', 'notes'],
  created () {
    if (this.notes !== null) {
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
    }
  },
  computed: {
    totalNotes () {
      return (type) => {
        if (this.notes !== null) {
          const f = this.notes.filter((n) => {
            const t = Web3Utils.hexToNumberString(n.token);
            return t === type;
          });
          return f.length;
        }
        return 0;
      };
    },
  },
  watch: {
    selectedAccount (newAccount) {
      this.$emit('selectAccount', newAccount);
    },
  },
};
</script>
