<template>
  <div
    class="button-container"
    :disabled="loading"
  >
    <div
      v-if="loading"
      class="fa-2x"
    >
      <i class="fa fa-spinner fa-spin"></i>
    </div>
    <div
      class="button-text"
      v-else
    >
      {{ text }}
    </div>
  </div>
</template>

<script>
export default {
  props: {
    loading: {
      type: Boolean,
      default: false,
    },
    text: {
      type: String,
      default: '',
    },
  },
};
</script>

<style lang="scss" scoped>
@import "StandardButton.scss";
</style>
