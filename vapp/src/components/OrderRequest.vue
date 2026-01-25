<template>
  <div class="box">
    <div class="container">
      <div class="columns">
        <div class="column">
          <h2>DAI-ETH</h2>
          <section style="margin-top: 20px; margin-left: 15px;">
            <div class="field">
              <o-radio v-model="radio" native-value="buy">BUY</o-radio>
            </div>
            <div class="field">
              <o-radio v-model="radio" native-value="sell">SELL</o-radio>
            </div>
          </section>
        </div>
        <div class="column">
          <o-tabs position="right" type="toggle" v-model="activeTab" style="float: right;">
            <o-tab-item label="Make" :value="0"></o-tab-item>
            <o-tab-item label="Take" :value="1"></o-tab-item>
          </o-tabs>
        </div>
      </div>
      <OrderRequestMake v-if="activeTab === 0" ref="orderRequestMakeRef" :radio="radio" />
      <OrderRequestTake v-else-if="activeTab === 1" ref="orderRequestTakeRef" :radio="radio" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useOrderStore, type BuyOrSell, type MakeOrTake } from '@/stores/order'
import type { Note } from '@/stores/note'
import OrderRequestMake from './OrderRequestMake.vue'
import OrderRequestTake from './OrderRequestTake.vue'

const orderStore = useOrderStore()

const radio = ref<BuyOrSell>('buy')
const activeTab = ref(0)

const orderRequestMakeRef = ref<InstanceType<typeof OrderRequestMake> | null>(null)
const orderRequestTakeRef = ref<InstanceType<typeof OrderRequestTake> | null>(null)

watch(radio, (choice) => {
  orderStore.selectBuyOrSell(choice)
})

watch(activeTab, (tab) => {
  const makeOrTake: MakeOrTake = tab === 0 ? 'make' : 'take'
  orderStore.selectMakeOrTake(makeOrTake)
})

function selectNote(note: Note) {
  if (activeTab.value === 0) {
    orderRequestMakeRef.value?.selectNote(note)
  } else {
    orderRequestTakeRef.value?.selectNote(note)
  }
}

defineExpose({ selectNote })
</script>

<style scoped>
</style>
