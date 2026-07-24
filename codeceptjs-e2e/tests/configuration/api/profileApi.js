const assert = require('assert');

const { I } = inject();
const PATH = 'graph/api/user/password';

/**
 * User profile Page API
 */
module.exports = {

  /**
   * Change the password for the current user using Profile Page API
   *
   * @param   user              Current user login
   * @param   currentPassword   Current password for authenticated account
   * @param   newPassword       new password to set
   * @return                    {Promise<void>}
   */
  async changePassword(user, currentPassword, newPassword) {
    const headers = { Authorization: `Basic ${await I.getAuth(user, currentPassword)}` };
    const body = {
      oldPassword: currentPassword,
      newPassword,
      confirmNew: newPassword,
    };
    const resp = await I.sendPutRequest(PATH, body, headers);

    assert.equal(
      resp.status,
      200,
      `Failed change user account password! Response message is "${resp.data.message}"`,
    );
  },

};
