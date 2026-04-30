const assert = require('assert');

const { I } = inject();

module.exports = {
  async verifyAmazonInstanceId(instanceId) {
    const response = await I.sendGetRequest(`v1/server/AWSInstance?instance_id=${instanceId}`);

    assert.ok(
      response.status === 200,
      `Failed to validate AMI Instance with instance id as "${instanceId}". Response message is "${response.data.message}"`,
    );
  },
};
