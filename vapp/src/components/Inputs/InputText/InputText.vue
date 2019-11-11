<template>
  <div class="input-text">
    <div class="label-container">
      <p>{{ label }}</p>
    </div>
    <div class="input-container">
      <p class="static"
        v-if="isStaticValue">
        {{ value }}
      </p>
      <slot name="input"></slot>
      <p class="unit">{{ unit }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    label: {
      type: String,
      default: '',
    },
    value: {
      // no type restriction.
    },
    unit: {
      type: String,
      default: '',
    },
    isStaticValue: {
      type: Boolean,
      default: true,
    },
  },
};
</script>

<style lang="scss" scoped>
@import "InputText.scss";
</style>
