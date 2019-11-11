<template>
<!-- TODO: 다시 짜기 class -->
  <div class="account-import-layout">
    <div class="import-option-container">
      <div class="import-option"
        :class="{ selected: selectedOption === 'keystore' }"
        @click="clickOption('keystore')"
      >
        <img src="../../assets/icons/components/keystore-selected.png" class="keystore"
          v-if="selectedOption === 'keystore'"
        />
        <img src="../../assets/icons/components/keystore.png" class="keystore"
          v-else
        />
        <p>Keystore File</p>
      </div>
      <div class="import-option"
        :class="{ selected: selectedOption === 'privateKey' }"
        @click="clickOption('privateKey')"
      >
        <img src="../../assets/icons/components/private-key-selected.png" class="private-key"
          v-if="selectedOption === 'privateKey'"
        />
        <img src="../../assets/icons/components/key.png" class="private-key"
          v-else
        />
        <p>Private Key</p>
      </div>
    </div>
    <div class="import-account-container"
      v-if="selectedOption === 'keystore'"
    >
      <div>
        <p>업로드된 파일명</p>
        <input-account
          labelType="password"
        />
        <button>Import</button>
      </div>
    </div>
    <div class="import-account-container"
      v-else-if="selectedOption === 'privateKey'"
    >
      <div>
        <p>업로드된 키</p>
        <input-account labelType="key" />
        <button>Import</button>
      </div>
    </div>
    <div class="import-account-container" style="margin-top: 24px;"
      v-if="selectedOption === 'privateKey'"
    >
      <div class="account-info-container">
        <p>Account</p>
        <p>00000abcd00000abcd</p>
        <p>imported</p>
      </div>
      <input-account
        labelType="password"
      />
      <input-account style="margin-top: 10px;"
        labelType="password" />
      <button>Confirm</button>
    </div>
  </div>
</template>

<script>
import InputAccount from '../../components/Inputs/InputAccount';

export default {
  data () {
    return {
      selectedOption: '',
    };
  },
  components: {
    InputAccount,
  },
  methods: {
    clickOption (option) {
      this.selectedOption = option;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "AccountImportLayout.scss";
</style>
