<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'App',
};
</script>

<style lang="scss">
// Disable the widescreen breakpoint
$widescreen-enabled: false;
// Disable the fullhd breakpoint
$fullhd-enabled: false;
@import "~bulma";
@import "~buefy/src/scss/buefy";
// Custom styles
html,
body,
#wrapper,
.container {
  height: 100%;
}
.container {
  margin: 0 auto;
}
@media all and (max-width: 1088px) {
  .container {
    padding: 20px;
  }
}

.table {
  width: 100%;
}

.zone {
  border: 2px solid #f3f3f3;
  padding: 10px;
  border-radius: 25px;
}
</style>
