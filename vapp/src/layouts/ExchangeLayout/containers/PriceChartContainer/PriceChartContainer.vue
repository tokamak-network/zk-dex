<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/pricechart.png" />
      <h3>Price Chart</h3>
      <radio-button
        leftTitle="1M"
        rightTitle="1W"
      />
    </div>
    <div class="price-chart-container">
      <price-chart />
    </div>
  </div>
</template>

<script>
import RadioButton from '../../../../components/RadioButton';
import PriceChart from '../../components/PriceChart';

export default {
  components: {
    RadioButton,
    PriceChart,
  },
};
</script>

<style lang="scss" scoped>
@import "PriceChartContainer.scss";
</style>
