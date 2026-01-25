<template>
  <div style="padding: 50px;">
    <input class="input" style="width: 20%; margin-right: 10px;" placeholder="key" v-model="userKey">
    <a class="button is-link" :class="{ 'is-static': userKey === '' }" @click="login">login</a>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/account'
import * as api from '@/api'
import { hexlify, randomBytes } from 'ethers'

const router = useRouter()
const accountStore = useAccountStore()

const userKey = ref('')

onMounted(() => {
  if (accountStore.key) {
    router.push({ path: '/' })
  }
})

async function login() {
  if (!userKey.value) return

  try {
    let vk = await api.getViewingKey(userKey.value)

    if (!vk) {
      // Viewing key must be less than 64 bits
      vk = hexlify(randomBytes(8))
      await api.setViewingKey(userKey.value, vk)
    }

    accountStore.setKey(userKey.value)
    accountStore.setViewingKey(vk)
    router.push({ path: '/' })
  } catch (err) {
    console.error('Login failed:', err)
  }
}
</script>
