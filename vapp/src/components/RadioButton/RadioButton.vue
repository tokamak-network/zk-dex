<template>
  <div>
    <button
      class="radio-left-button"
      :class="whichRadioButtonClicked === 'left'
      ? 'left-selected-radio-button'
      : 'left-unselected-radio-button'"
      @click="selectRadioButton('left')"
    >
      {{ leftTitle }}
    </button>
    <button
      class="radio-right-button"
      :class="whichRadioButtonClicked === 'right'
      ? 'right-selected-radio-button'
      : 'right-unselected-radio-button'"
      @click="selectRadioButton('right')"
    >
      {{ rightTitle }}
    </button>
  </div>
</template>

<script>
// TODO: when button is clicked, color have to be changed.
export default {
  data () {
    return {
      whichRadioButtonClicked: 'left',
    };
  },
  props: {
    leftTitle: {
      type: String,
      default: '',
    },
    rightTitle: {
      type: String,
      default: '',
    },
  },
  methods: {
    selectRadioButton (radioButton) {
      this.whichRadioButtonClicked = radioButton;
      this.$emit('radioButtonClicked', radioButton);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "RadioButton.scss";
</style>
