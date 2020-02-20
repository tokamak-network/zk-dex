<template>
  <div>
    <order-ongoing-container style="margin-bottom: 24px; "/>
    <order-history-container />
  </div>
</template>

<script>
import OrderOngoingContainer from '../DashboardLayout/containers/OrderOngoingContainer';
import OrderHistoryContainer from '../DashboardLayout/containers/OrderHistoryContainer';

export default {
  components: {
    OrderOngoingContainer,
    OrderHistoryContainer,
  },
};
</script>
