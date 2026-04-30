const assert = require('assert');

const { I } = inject();

module.exports = {
  url: 'graph/alerting/routes',
  elements: {
  },
  buttons: {
    newPolicy: locate('button').find('span').withText('New child policy'),
  },
  messages: {
  },
};
