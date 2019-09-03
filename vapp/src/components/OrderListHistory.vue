<template>
  <div class="box">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Order History </p>
    </div>
      <table class="table fixed_header">
        <thead>
          <tr>
            <th>Order</th>
            <th>Type</th>
            <th>Price (DAI)</th>
            <th>DAI Amount</th>
            <th>ETH Amount</th>
            <th>Change</th>
            <th>State</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in completedOrderHistory">
            <td>{{ order.orderId | hexToNumberString }}</td>
            <td>{{ order.type | orderType }}</td>
            <td>{{ order.price | hexToNumberString }}</td>
            <td>{{ order.makerNoteAmount | hexToNumberString }}</td>
            <td>{{ order.takerNoteAmount | hexToNumberString }}</td>
            <td>{{ change(order) | hexToNumberString }}</td>
            <td>{{ order.state | orderState }}</td>
            <td>{{ order.timestamp }}</td>
          </tr>
        </tbody>
      </table>
  </div>
</template>

<script>
import Web3Utils from 'web3-utils';

export default {
  props: ['completedOrderHistory'],
  methods: {
    change (order) {
      const makerNoteAmount = Web3Utils.toBN(order.makerNoteAmount);
      const takerNoteAmount = Web3Utils.toBN(order.takerNoteAmount);
      const price = Web3Utils.toBN(order.price);

      if ((makerNoteAmount.mul(price)).cmp(takerNoteAmount) >= 0) {
        return makerNoteAmount.sub(takerNoteAmount.div(price));
      } else {
        return takerNoteAmount.sub(makerNoteAmount.mul(price));
      }
    },
  },
};
</script>
