const { I } = inject();
const assert = require('assert');

module.exports = {

  fields: {
    startTourButton: '//button[span[text()="Start tour"]]',
    nextSlideButton: '//div[@class="pmm-tour"]//button[div][2]',
    doneButton: '//div[@class="pmm-tour"]//button[span[text()="Done"]]',
  },

  slideHeader: (name) => `//div[@class="pmm-tour"]//strong[text()="${name}"]`,
};
