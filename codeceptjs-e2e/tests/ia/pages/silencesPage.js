const assert = require('assert');

const { I } = inject();

module.exports = {
  url: '/graph/alerting/silences',
  elements: {
  },
  buttons: {
    newSilence: locate('a').withText('Create silence'),
  },
  messages: {
  },
};
