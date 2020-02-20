<template>
  <div class="input-account">
    <div v-if="labelType !== 'empty'" class="label-container">
      <img v-if="labelType === 'password'" src="../../../assets/icons/components/key.png" />
      <p v-else-if="labelType === 'key'">Private Key</p>
    </div>
    <div :class="labelType !== 'empty' ? 'input-with-label-container' : 'input-without-label-container'">
      <input ref="input" type="text" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    labelType: {
      type: String,
      default: 'empty',
    },
  },
};
</script>

<style lang="scss" scoped>
@import "InputAccount.scss";
</style>
