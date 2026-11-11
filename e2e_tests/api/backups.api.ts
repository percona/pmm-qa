import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import { GetService } from '@interfaces/inventory';
import { BackupStatus } from '@interfaces/backup';
import { Timeouts } from '@helpers/timeouts';
import { s3StorageConnection } from '@testdata/backupLocations';

interface BackupArtifact {
  artifact_id: string;
  name: string;
  service_name: string;
  status: string;
}

interface BackupArtifactsResponse {
  artifacts?: BackupArtifact[];
}

interface BackupLocation {
  location_id: string;
  name: string;
}

interface BackupLocationsResponse {
  locations?: BackupLocation[];
}

interface Restore {
  restore_id: string;
  status: string;
}

interface RestoresResponse {
  items?: Restore[];
}

interface ScheduledBackup {
  name: string;
  scheduled_backup_id: string;
  service_id?: string;
}

interface ScheduledBackupsResponse {
  scheduled_backups?: ScheduledBackup[];
}

type BackupMode = 'BACKUP_MODE_PITR' | 'BACKUP_MODE_SNAPSHOT';
type DataModel = 'DATA_MODEL_LOGICAL' | 'DATA_MODEL_PHYSICAL';

const BACKUP_LOCATION_NAME = 'mongo-location-pbm-dashboard-test';
const BACKUP_NAME_PREFIX = 'test_schedule_pbm';
const LOCAL_STORAGE_CONFIG = { path: '/tmp/backup_data' };

export default class BackupsApi {
  constructor(private request: APIRequestContext) {}

  addLocalLocation = async (name: string) => {
    const response = await this.request.post(apiEndpoints.backups.locations, {
      data: { filesystem_config: LOCAL_STORAGE_CONFIG, name },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { location_id: string }).location_id;
  };

  addS3Location = async (name: string, description: string) => {
    const response = await this.request.post(apiEndpoints.backups.locations, {
      data: { description, name, s3_config: s3StorageConnection },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { location_id: string }).location_id;
  };

  createScheduledBackup = async (schedule: {
    cron_expression: string;
    data_model: DataModel;
    description: string;
    enabled: boolean;
    location_id: string;
    mode: BackupMode;
    name: string;
    retention: number;
    retries: number;
    retry_interval: string;
    service_id: string;
  }) => {
    const response = await this.request.post(apiEndpoints.backups.schedule, {
      data: schedule,
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { scheduled_backup_id: string }).scheduled_backup_id;
  };

  disableScheduledBackup = async (scheduledBackupId: string) => {
    const response = await this.request.put(apiEndpoints.backups.changeScheduled, {
      data: { enabled: false, scheduled_backup_id: scheduledBackupId },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);
  };

  ensureMongoBackupData = async (service: GetService, mode: BackupMode = 'BACKUP_MODE_SNAPSHOT') => {
    const locationId = await this.ensureLocalStorageLocation();
    const scheduleName = `${BACKUP_NAME_PREFIX}_${mode}`;

    await this.ensureScheduledBackup(service.service_id, locationId, scheduleName, mode);
    await expect
      .poll(
        async () =>
          (await this.getArtifacts()).some(
            ({ name, service_name, status }) =>
              service_name === service.service_name &&
              name.startsWith(scheduleName) &&
              status === 'BACKUP_STATUS_SUCCESS',
          ),
        {
          intervals: [Timeouts.FIVE_SECONDS],
          message: `Backup artifact for ${service.service_name} should be successful`,
          timeout: Timeouts.FIVE_MINUTES,
        },
      )
      .toBe(true);
  };

  getArtifacts = async () => {
    const response = await this.request.get(apiEndpoints.backups.artifacts, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);

    return ((await response.json()) as BackupArtifactsResponse).artifacts ?? [];
  };

  getLocations = async () => {
    const response = await this.request.get(apiEndpoints.backups.locations, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);

    return ((await response.json()) as BackupLocationsResponse).locations ?? [];
  };

  getRestores = async () => {
    const response = await this.request.get(apiEndpoints.backups.restores, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);

    return ((await response.json()) as RestoresResponse).items ?? [];
  };

  getScheduledBackups = async () => {
    const response = await this.request.get(apiEndpoints.backups.scheduled, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);

    return ((await response.json()) as ScheduledBackupsResponse).scheduled_backups ?? [];
  };

  removeAllArtifacts = async () => {
    await this.waitForRunningBackups();

    for (const { artifact_id } of await this.getArtifacts()) {
      const response = await this.request.delete(`${apiEndpoints.backups.artifacts}/${artifact_id}`, {
        headers: GrafanaHelper.getAuthHeader(),
        params: { remove_files: true },
      });

      expect(response.status(), await response.text()).toEqual(200);
    }

    await expect
      .poll(async () => (await this.getArtifacts()).map(({ artifact_id }) => artifact_id), {
        intervals: [Timeouts.FIVE_SECONDS],
        message: 'Removed backup artifacts should be gone',
        timeout: Timeouts.FIVE_MINUTES,
      })
      .toEqual([]);
  };

  removeAllLocations = async () => {
    // A force delete while PBM is still writing leaves backup files with no PMM artifact.
    await this.waitForRunningBackups();

    for (const { location_id } of await this.getLocations()) {
      const response = await this.request.delete(`${apiEndpoints.backups.locations}/${location_id}`, {
        headers: GrafanaHelper.getAuthHeader(),
        params: { force: true },
      });

      expect(response.status(), response.statusText()).toEqual(200);
    }
  };

  removeAllScheduledBackups = async () => {
    for (const { scheduled_backup_id } of await this.getScheduledBackups()) {
      const response = await this.request.delete(
        `${apiEndpoints.backups.removeScheduled}/${scheduled_backup_id}`,
        {
          headers: GrafanaHelper.getAuthHeader(),
        },
      );

      expect(response.status(), response.statusText()).toEqual(200);
    }
  };

  startBackup = async (
    name: string,
    serviceId: string,
    locationId: string,
    options: { data_model?: DataModel; retries?: number; retry_interval?: string } = {},
  ) => {
    const response = await this.request.post(apiEndpoints.backups.startBackup, {
      data: {
        data_model: 'DATA_MODEL_LOGICAL',
        description: '',
        location_id: locationId,
        name,
        service_id: serviceId,
        ...options,
      },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { artifact_id: string }).artifact_id;
  };

  startRestore = async (artifactId: string, serviceId: string) => {
    const response = await this.request.post(apiEndpoints.backups.startRestore, {
      data: { artifact_id: artifactId, service_id: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { restore_id: string }).restore_id;
  };

  verifyBackupStatus = async (namePrefix: string, status: BackupStatus) => {
    await expect
      .poll(
        async () =>
          (await this.getArtifacts()).some(
            (artifact) => artifact.name.startsWith(namePrefix) && artifact.status === status,
          ),
        {
          intervals: [Timeouts.FIVE_SECONDS],
          message: `A backup artifact named ${namePrefix}* should reach ${status}`,
          timeout: Timeouts.FIVE_MINUTES,
        },
      )
      .toBe(true);
  };

  verifyBackupSuccess = async (artifactId: string) => {
    await expect
      .poll(
        async () => (await this.getArtifacts()).find(({ artifact_id }) => artifact_id === artifactId)?.status,
        {
          intervals: [Timeouts.FIVE_SECONDS],
          message: `Backup artifact ${artifactId} should succeed`,
          timeout: Timeouts.FIVE_MINUTES,
        },
      )
      .toBe('BACKUP_STATUS_SUCCESS');
  };

  waitForRunningBackups = async () => {
    await expect
      .poll(
        async () =>
          (await this.getArtifacts())
            .filter(({ status }) =>
              /^BACKUP_STATUS_(PENDING|IN_PROGRESS|DELETING|CLEANUP_IN_PROGRESS)$/.test(status),
            )
            .map(({ artifact_id }) => artifact_id),
        {
          intervals: [Timeouts.FIVE_SECONDS],
          message: 'Running backups should finish before they are deleted',
          timeout: Timeouts.FIVE_MINUTES,
        },
      )
      .toEqual([]);
  };

  private ensureLocalStorageLocation = async () => {
    const existingLocation = (await this.getLocations()).find(({ name }) => name === BACKUP_LOCATION_NAME);

    if (existingLocation) return existingLocation.location_id;

    return this.addLocalLocation(BACKUP_LOCATION_NAME);
  };

  private ensureScheduledBackup = async (
    serviceId: string,
    locationId: string,
    scheduleName: string,
    mode: BackupMode,
  ) => {
    const existingSchedule = (await this.getScheduledBackups()).find(
      ({ name, service_id }) => name === scheduleName && service_id === serviceId,
    );

    if (existingSchedule) return;

    await this.createScheduledBackup({
      cron_expression: '* * * * *',
      data_model: 'DATA_MODEL_LOGICAL',
      description: 'Dashboard screenshot data seed',
      enabled: true,
      location_id: locationId,
      mode,
      name: scheduleName,
      retention: 7,
      retries: 0,
      retry_interval: '30s',
      service_id: serviceId,
    });
  };
}
