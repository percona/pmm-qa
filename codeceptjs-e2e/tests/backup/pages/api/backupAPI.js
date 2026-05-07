const { I } = inject();
const assert = require('assert');

module.exports = {
  async startBackup(name, service_id, location_id, autoRetries = false, isLogical = true) {
    const data_model = isLogical ? 'DATA_MODEL_LOGICAL' : 'DATA_MODEL_PHYSICAL';
    const retryConfig = {
      retries: 5,
      retry_interval: '60s',
    };
    const retires = autoRetries ? retryConfig : {};
    const body = {
      service_id,
      location_id,
      name,
      description: '',
      data_model,
      ...retires,
    };

    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendPostRequest('v1/backups:start', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to start a backup "${name}". Response message is "${resp.data.message}"`,
    );

    return resp.data.artifact_id;
  },

  // waitForBackupFinish waits for backup to finish. If artifactId is null, scheduleName will be used for filtering
  async waitForBackupFinish(artifactId, scheduleName, timeout = 120) {
    for (let i = 0; i < timeout / 5; i++) {
      const artifacts = await this.getArtifactsList();

      if (!artifacts) {
        I.wait(5);
        // eslint-disable-next-line no-continue
        continue;
      }

      let found;

      artifactId
        ? found = artifacts.filter(({ artifact_id, status }) => status !== 'BACKUP_STATUS_PENDING' && artifact_id === artifactId)
        : found = artifacts.filter(({ name, status }) => status !== 'BACKUP_STATUS_PENDING' && name.startsWith(scheduleName));

      if (found.length) return;

      I.wait(5);
    }

    throw new Error(`Backup was not finished for schedule: ${scheduleName} in ${timeout} seconds`);
  },

  // getArtifactByName returns artifact object by name
  async getArtifactByName(artifactName) {
    if (!artifactName) throw new Error('artifactName can not be undefined or null');

    const artifacts = await this.getArtifactsList();

    return artifacts.find(({ name }) => name === artifactName);
  },

  // getArtifactsList returns array of artifacts
  async getArtifactsList() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendGetRequest('v1/backups/artifacts', headers);

    return resp.data.artifacts;
  },

  async getArtifactDate(scheduleName) {
    const artifacts = await this.getArtifactsList();
    const artifact = artifacts.filter(({ name, status }) => status !== 'BACKUP_STATUS_PENDING' && name.startsWith(scheduleName));

    return artifact[0].created_at;
  },

  async startRestore(service_id, artifact_id) {
    const body = {
      service_id,
      artifact_id,
    };

    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendPostRequest('v1/backups/restores:start', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to start a restore. Response message is "${resp.data.message}"`,
    );

    return resp.data.restore_id;
  },

  // waitForRestoreFinish waits for restore to finish
  async waitForRestoreFinish(restoreId, timeout = 120) {
    for (let i = 0; i < timeout / 5; i++) {
      const artifacts = await this.getRestoreHistoryList();
      const found = artifacts.filter(({ restore_id, status }) => status !== 'RESTORE_STATUS_IN_PROGRESS' && restore_id === restoreId);

      if (found.length) break;

      I.wait(5);
    }
  },

  // getRestoreHistoryList returns array of restores
  async getRestoreHistoryList() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendGetRequest('v1/backups/restores', headers);

    assert.ok(
      resp.status === 200,
      `Failed to get restore history list. Response message is "${resp.data.message}"`,
    );

    return resp.data.items;
  },

  // clearAllArtifacts deletes all artifacts from PMM and from storage
  async clearAllArtifacts() {
    const artifacts = await this.getArtifactsList();

    if (!artifacts) return;

    for (const { artifact_id } of artifacts) {
      await this.deleteArtifact(artifact_id);
    }
  },

  // deleteArtifact removes artifact by ID, pass remove_files=false if you want to keep it on the storage
  async deleteArtifact(artifact_id, remove_files = true) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const body = {
      remove_files,
    };

    await I.sendDeleteRequest(`v1/backups/artifacts/${artifact_id}`, body, headers);

    // assert.ok(
    //   resp.status === 200,
    //   `Failed to delete backup artifact ${artifact_id}. Response message is "${resp.data.message}"`,
    // );
  },
};
