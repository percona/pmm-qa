const { I } = inject();
const assert = require('assert');

const backupModes = {
  snapshot: 'BACKUP_MODE_SNAPSHOT',
  pitr: 'BACKUP_MODE_PITR',
};

module.exports = {
  backupModes,
  async createScheduledBackup(scheduleObj) {
    const {
      service_id,
      location_id,
      name,
      mode = backupModes.snapshot,
      description = 'description',
      cron_expression = '0 0 * * *',
      retry_interval = '30s',
      retries = 0,
      retention = 7,
      enabled = true,
      isLogical = true,
    } = scheduleObj;

    const data_model = isLogical ? 'DATA_MODEL_LOGICAL' : 'DATA_MODEL_PHYSICAL';
    const body = {
      service_id,
      location_id,
      cron_expression,
      name,
      mode,
      description,
      retry_interval,
      retries,
      enabled,
      retention,
      data_model,
    };

    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendPostRequest('v1/backups:schedule', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to create a scheduled backup with name "${name}" and params ${JSON.stringify(body, null, 2)}.
       Response message is "${resp.data.message}"`,
    );

    return resp.data.scheduled_backup_id;
  },

  async clearAllSchedules() {
    const schedules = await this.getScheduledList();

    if (!schedules) return;

    for (const { scheduled_backup_id } of schedules) {
      await this.removeScheduledBackup(scheduled_backup_id);
    }
  },

  async getScheduledList() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendGetRequest('v1/backups/scheduled', headers);

    return resp.data.scheduled_backups;
  },

  async waitForFirstExecution(scheduledBackupName, timeout = 120) {
    for (let i = 0; i < timeout / 5; i++) {
      const schedules = await this.getScheduledList();

      if (!schedules) {
        I.wait(5);
        // eslint-disable-next-line no-continue
        continue;
      }

      const found = schedules.filter(({ last_run = null, name }) => name === scheduledBackupName && last_run);

      if (found.length) break;

      I.wait(5);
    }
  },

  async removeScheduledBackup(scheduledId) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendDeleteRequest(`v1/backups/${scheduledId}`, headers);

    assert.ok(
      resp.status === 200,
      `Failed to remove scheduled backup with ID "${scheduledId}". Response message is "${resp.data.message}"`,
    );
  },

  async getScheduleIdByName(scheduleName) {
    const scheduledBackups = await this.getScheduledList();

    return scheduledBackups.find(({ name }) => name === scheduleName);
  },

  async disableScheduledBackup(scheduledId) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      enabled: false,
      scheduled_backup_id: scheduledId,
    };
    const resp = await I.sendPutRequest('v1/backups:changeScheduled', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to disable scheduled backup with ID "${scheduledId}". Response message is "${resp.data.message}"`,
    );
  },
};
