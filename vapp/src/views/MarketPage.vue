<template>
  <div>
    <section class="section">
      <div class="container">
        <!-- <div class="columns" style="margin-top: 20px; margin-bottom: 80px;">
          <div class="column is-three-fifths">
            <order-list />
          </div>
          <div class="column">
            <order-chart />
          </div>
        </div> -->
        <div class="columns" style="margin-bottom: 80px;">
          <div class="column is-three-fifths">
            <div>
              <order-request />
              <div style="margin-top: 20px;" class="zone">
                <note-list />
              </div>
            </div>
          </div>
          <div class="column">
            <order-list />
          </div>
        </div>
        <order-list-ongoing style="margin-bottom: 80px;" />
        <order-list-history />
      </div>
    </section>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import NoteList from '../components/NoteList.vue';
import OrderList from '../components/OrderList.vue';
import OrderRequest from '../components/OrderRequest.vue';
import OrderChart from '../components/OrderChart.vue';
import OrderListOngoing from '../components/OrderListOngoing.vue';
import OrderListHistory from '../components/OrderListHistory.vue';

export default {
  data () {
    return {
      isNoteSelected: false,
    };
  },
  components: {
    NoteList,
    OrderList,
    OrderRequest,
    // OrderChart,
    OrderListOngoing,
    OrderListHistory,
  },
  computed: mapState({
    viewingKey: state => state.viewingKey,
    secretKey: state => state.secretKey,
    order: state => state.order,
    note: state => state.note,
  }),
  methods: {
    mintNote () {},
    moveMintNotePage (token) {
      this.$router.push({ path: `/mint/${token}` });
    },
    makeOrder () {
      this.$router.push({ path: '/make' });
    },
    takeOrder () {
      this.$router.push({ path: '/take' });
    },
  },
};
</script>
