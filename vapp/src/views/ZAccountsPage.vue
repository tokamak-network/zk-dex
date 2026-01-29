<template>
  <div>
    <div class="tabs is-boxed">
      <ul>
        <li :class="{ 'is-active': activeTab === 'create' }">
          <a @click="activeTab = 'create'">Create</a>
        </li>
        <li :class="{ 'is-active': activeTab === 'import' }">
          <a @click="activeTab = 'import'">Import</a>
        </li>
        <li :class="{ 'is-active': activeTab === 'export' }">
          <a @click="activeTab = 'export'">Export</a>
        </li>
        <li :class="{ 'is-active': activeTab === 'delete' }">
          <a @click="activeTab = 'delete'">Delete</a>
        </li>
      </ul>
    </div>

    <AccountCreatePage v-if="activeTab === 'create'" />
    <AccountImportPage v-else-if="activeTab === 'import'" />
    <AccountExportPage v-else-if="activeTab === 'export'" />
    <AccountDeletePage v-else-if="activeTab === 'delete'" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AccountCreatePage from '@/views/AccountCreatePage.vue'
import AccountImportPage from '@/views/AccountImportPage.vue'
import AccountExportPage from '@/views/AccountExportPage.vue'
import AccountDeletePage from '@/views/AccountDeletePage.vue'

const activeTab = ref<'create' | 'import' | 'export' | 'delete'>('create')
</script>

<style scoped>
.tabs {
  margin-bottom: 20px;
}
</style>
