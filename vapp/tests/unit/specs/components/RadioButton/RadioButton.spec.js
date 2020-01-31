import RadioButton from '../../../../../src/components/RadioButton';
import { shallowMount } from '@vue/test-utils';
import { LocalVue } from '../../../helpers';

describe('RadioButton.vue', () => {
  let localVue, wrapper, store;

  beforeAll(() => {
    const localVueInstance = LocalVue.createLocalVueInstance();
    localVue = localVueInstance.localVue;
    store = localVueInstance.store;
  });

  beforeEach(() => {
    wrapper = shallowMount(RadioButton, {
      localVue,
      store,
    });
  });

  it('should render correct title props', () => {
    const leftTitle = 'leftTitle';
    const rightTitle = 'rightTitle';

    wrapper.setProps({ leftTitle, rightTitle });

    expect(
      wrapper.vm.$el.querySelector('.radio-left-button').textContent.trim()
    ).toEqual(leftTitle);
    expect(
      wrapper.vm.$el.querySelector('.radio-right-button').textContent.trim()
    ).toEqual(rightTitle);
  });

  it('should change `class` when radio button clicked', () => {
    const leftRadioButton = wrapper.find('.radio-left-button');
    const rightRadioButton = wrapper.find('.radio-right-button');

    leftRadioButton.trigger('click');
    expect(
      wrapper
        .find('.radio-left-button')
        .classes('left-selected-radio-button')
    ).toBe(true);
    expect(
      wrapper
        .find('.radio-right-button')
        .classes('right-unselected-radio-button')
    ).toBe(true);

    rightRadioButton.trigger('click');
    expect(
      wrapper
        .find('.radio-left-button')
        .classes('left-unselected-radio-button')
    ).toBe(true);
    expect(
      wrapper
        .find('.radio-right-button')
        .classes('right-selected-radio-button')
    ).toBe(true);
  });
});
