const { I } = inject();

module.exports = {

  /**
   * Obtains current PMM Server Version via API v1
   *
   * @return {Promise<{version: string, major: number, minor: number, patch: number}>}
   */
  async getPmmVersion() {
    const resp = await I.sendGetRequest('v1/version', { Authorization: `Basic ${await I.getAuth()}` });

    I.assertEqual(
      resp.status,
      200,
      `Request should be OK: "${resp.status} ${resp.statusText}" ${resp.data.error ? resp.data : ''}`,
    );
    await I.say(`PMM Server version: ${resp.data.version}`);

    const [versionMajor, versionMinor, versionPatch] = resp.data.version.split('.');

    return {
      version: resp.data.version,
      major: parseInt(versionMajor, 10),
      minor: parseInt(versionMinor, 10),
      patch: parseInt(versionPatch, 10),
    };
  },
};
