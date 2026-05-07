const assert = require('assert');

const { I } = inject();

module.exports = {
  url: 'graph/alerting/admin',
  elements: {},
  buttons: {
    editConfig: locate('button').withText('Edit configuration'),
  },
  messages: {
  },
};
