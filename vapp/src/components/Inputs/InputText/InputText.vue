<template>
  <div class="input-text">
    <div class="label-container">
      <p>{{ label }}</p>
    </div>
    <div class="input-container">
      <div v-if="isStaticValue" class="static">
        <div v-if="label === 'Order ID'">
          {{ value | toNumber }}
        </div>
        <div v-if="label === 'Note Amount'">
          {{ value | fromWei }}
        </div>
        <div v-else-if="type === 'priceToTake'">
          {{ value | fromWei }}
        </div>
        <div v-else-if="label === 'Price'">
          {{ value | stringToHex | toNumber }}
        </div>
        <div v-else>
          {{ value }}
        </div>
      </div>
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
    type: {
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
