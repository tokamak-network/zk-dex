import { createLocalVue } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import Vuex from 'vuex';
import { state, getters } from '../helpers/mockStore';

function createLocalVueInstance () {
  const localVue = createLocalVue();
  localVue.use(BootstrapVue);
  localVue.use(Vuex);

  const actions = {
    // clearWallet: jest.fn(),
    // decryptWallet: jest.fn(),
    // setGasPrice: jest.fn(),
    // addSwapNotification: jest.fn(),
  };
  const store = new Vuex.Store({
    actions,
    getters,
    state,
  });

  return {
    localVue,
    store,
  };
}

export default {
  createLocalVueInstance,
};
