<template>
  <div>
    <el-button
      tag="router-link"
      to="/mint"
      @click="moveMintNotePage()">mint note</el-button>
    <my-notes />
    <div>
      {{ viewingKey}}
      {{ secretKey }}
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import MyNotes from '../../components/MyNotes';

export default {
  components: {
    MyNotes,
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

</style>
