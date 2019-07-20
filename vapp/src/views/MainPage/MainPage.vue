<template>
  <div>
    <el-row :gutter="10">
      <el-col :xs="8" :sm="6" :md="4" :lg="3" :xl="1">
        <div class="grid-content">
        </div>
      </el-col>
      <el-col :xs="4" :sm="6" :md="8" :lg="9" :xl="11">
        <order-book />
      </el-col>
      <el-col :xs="4" :sm="6" :md="8" :lg="9" :xl="11">
        <my-notes />
      </el-col>
      <el-col :xs="8" :sm="6" :md="4" :lg="3" :xl="1">
        <div class="grid-content">
        </div>
      </el-col>
    </el-row>
    <!-- <div style="height: 40px;"></div> -->
    <div style="width: 100%; text-align: center;">
      <div>
        <p>viewing key: {{ viewingKey}}</p>
      </div>
      <div>
        <p>secret key: {{ secretKey }}</p>
      </div>
      <el-button
        tag="router-link"
        to="/mint"
        @click="moveMintNotePage()">
        mint note
      </el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import MyNotes from '../../components/MyNotes';
import OrderBook from '../../components/OrderBook';

export default {
  components: {
    MyNotes,
    OrderBook
  },
  computed: mapState({
    viewingKey: state => state.viewingKey,
    secretKey: state => state.secretKey
  }),
  methods: {
    mintNote() {
    },
    moveMintNotePage() {
      this.$router.push({ path: '/mint' })
    }
  },
  // TODO: 참고하기
  // created() {
  //   axios.get(this.url)
  //     .then(response => {
  //       this.response = response.data;
  //       this.loading = false;
  //     })
  //     .catch(error => {
  //       alert('[ERROR] fetching the data', error);
  //       console.log(error);
  //     });
}
</script>

<style>
.grid-content {
  border-radius: 4px;
  min-height: 1px;
}
</style>
