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
          <tr v-for="order in finishedOrder">
            <td>{{ order.orderId }}</td>
            <td>{{ order.type }}</td>
            <td>{{ order.price | hexToNumberString }}</td>
            <td>{{ order.amount | hexToNumberString }}</td>
            <td>{{ order.receiveAmount | abbreviate }}</td>
            <td>{{ order.change }}</td>
            <td>{{ order.state | orderState }}</td>
            <td>{{ order.timestamp }}</td>
          </tr>
        </tbody>
      </table>
  </div>
</template>

<script>
export default {
  props: ['finishedOrder'],
};
</script>
