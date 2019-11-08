<template>
  <div class="exchange">
    <market />
    <div class="group">
      <price-chart-container class="wide" />
      <trade-history-container class="short" />
    </div>
    <div class="group">
      <div class="wide">
        <trade-container />
        <note-container />
      </div>
      <order-book-container class="short" />
    </div>
    <order-ongoing-container />
    <!-- <order-history-container /> -->
  </div>
</template>

<script>
import Market from './components/Market';
import PriceChartContainer from '../../layouts/ExchangeLayout/containers/PriceChartContainer';
import TradeHistoryContainer from '../../layouts/ExchangeLayout/containers/TradeHistoryContainer';
import TradeContainer from '../../layouts/ExchangeLayout/containers/TradeContainer';
import OrderBookContainer from '../../layouts/ExchangeLayout/containers/OrderBookContainer';
import NoteContainer from '../../layouts/ExchangeLayout/containers/NoteContainer';
import OrderOngoingContainer from '../../layouts/ExchangeLayout/containers/OrderOngoingContainer';
import OrderHistoryContainer from '../../layouts/ExchangeLayout/containers/OrderHistoryContainer';

export default {
  components: {
    Market,
    PriceChartContainer,
    TradeHistoryContainer,
    TradeContainer,
    OrderBookContainer,
    NoteContainer,
    OrderOngoingContainer,
    OrderHistoryContainer,
  },
};
</script>

<style lang="scss" scoped>
@import "ExchangeLayout.scss";
</style>

