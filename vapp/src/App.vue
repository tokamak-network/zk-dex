<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
// App component - Vue 3 with script setup
</script>

<style lang="scss">
// Disable the widescreen breakpoint
$widescreen-enabled: false;
// Disable the fullhd breakpoint
$fullhd-enabled: false;

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

.fixed_header {
  width: 400px;
  table-layout: fixed;
  border-collapse: collapse;
}

.fixed_header tbody {
  display: block;
  width: 100%;
  overflow: auto;
  height: 200px;
  cursor: pointer;
}

.fixed_header thead tr {
  display: block;
}

.fixed_header th,
.fixed_header td {
  padding: 5px;
  text-align: left;
  width: 200px;
}
</style>
