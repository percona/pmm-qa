const { I } = inject();
const { storageLocationConnection, psStorageLocationConnection } = require('../testData');

const storageType = {
  s3: 's3_config',
  localClient: 'filesystem_config',
};

const localStorageDefaultConfig = {
  path: '/tmp/backup_data',
};

module.exports = {
  storageType,
  localStorageDefaultConfig,
  storageLocationConnection,
  psStorageLocationConnection,

  async createStorageLocation(name, type, config, description = '') {
    const body = {
      name,
      description,
      [type]: config,
    };

    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendPostRequest('v1/backups/locations', body, headers);

    I.assertEqual(
      resp.status,
      200,
      `Failed to create a storage location with name "${name}". Response message is "${resp.data.message}"`,
    );

    return resp.data.location_id;
  },

  async clearAllLocations() {
    const locations = await this.getLocationsList();

    if (!locations) return;

    for (const { location_id } of locations) {
      await this.removeLocation(location_id, true);
    }
  },

  async getLocationsList() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendGetRequest('v1/backups/locations', headers);

    return resp.data.locations;
  },

  /**
   * Lookup and return Storage location fully matching specified name.
   *
   * @param   nameOfLocation  name {@code String} of the Location to lookup
   * @return                  {Promise<unknown>} Location object if found; {@code null} otherwise
   */
  async getLocationDetails(nameOfLocation) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendGetRequest('v1/backups/locations', headers);
    const result = Object.values(resp.data)
      .flat(Infinity)
      .filter(({ name }) => name === nameOfLocation);

    if (result.length) return result[0];

    await I.say(`Storage Location with name "${nameOfLocation}" not found!`);

    return null;
  },

  async removeLocation(locationId, force) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendDeleteRequest(`v1/backups/locations/${locationId}?force=${force}`, headers);

    I.assertEqual(
      resp.status,
      200,
      `Failed to remove storage location with ID "${locationId}". Response message is "${resp.data.message}"`,
    );
  },
};
