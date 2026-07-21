const assert = require('assert');

const { I } = inject();

module.exports = {
  url: '/graph/alerting/silences',
  elements: {
  },
  buttons: {
    newSilence: locate('a').withText('Add Silence'),
  },
  messages: {
  },
};
