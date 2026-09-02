import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import { GetService } from '@interfaces/inventory';

interface BackupArtifact {
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

interface ScheduledBackup {
  name: string;
  service_id?: string;
}

interface ScheduledBackupsResponse {
  scheduled_backups?: ScheduledBackup[];
}

type BackupMode = 'BACKUP_MODE_PITR' | 'BACKUP_MODE_SNAPSHOT';

const BACKUP_LOCATION_NAME = 'mongo-location-pbm-dashboard-test';
const BACKUP_NAME_PREFIX = 'test_schedule_pbm';
const LOCAL_STORAGE_CONFIG = { path: '/tmp/backup_data' };
const wait = async (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export default class BackupsApi {
  constructor(private request: APIRequestContext) {}

  ensureMongoBackupData = async (service: GetService, mode: BackupMode = 'BACKUP_MODE_SNAPSHOT') => {
    const locationId = await this.ensureLocalStorageLocation();
    const scheduleName = `${BACKUP_NAME_PREFIX}_${mode}`;

    await this.ensureScheduledBackup(service.service_id, locationId, scheduleName, mode);
    await this.waitForSuccessfulBackupArtifact(service.service_name, scheduleName);
  };

  private ensureLocalStorageLocation = async () => {
    const existingLocation = (await this.getLocations()).find(({ name }) => name === BACKUP_LOCATION_NAME);

    if (existingLocation) return existingLocation.location_id;

    const response = await this.request.post(apiEndpoints.backups.locations, {
      data: {
        filesystem_config: LOCAL_STORAGE_CONFIG,
        name: BACKUP_LOCATION_NAME,
      },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);

    return ((await response.json()) as { location_id: string }).location_id;
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

    const response = await this.request.post(apiEndpoints.backups.schedule, {
      data: {
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
      },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);
  };

  private getArtifacts = async () => {
    const response = await this.request.get(apiEndpoints.backups.artifacts, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);

    return ((await response.json()) as BackupArtifactsResponse).artifacts ?? [];
  };

  private getLocations = async () => {
    const response = await this.request.get(apiEndpoints.backups.locations, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);

    return ((await response.json()) as BackupLocationsResponse).locations ?? [];
  };

  private getScheduledBackups = async () => {
    const response = await this.request.get(apiEndpoints.backups.scheduled, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);

    return ((await response.json()) as ScheduledBackupsResponse).scheduled_backups ?? [];
  };

  private waitForSuccessfulBackupArtifact = async (
    serviceName: string,
    backupNamePrefix: string,
    timeoutSeconds = 180,
  ) => {
    for (let elapsedSeconds = 0; elapsedSeconds < timeoutSeconds; elapsedSeconds += 5) {
      const artifact = (await this.getArtifacts()).find(
        ({ name, service_name, status }) =>
          service_name === serviceName &&
          name.startsWith(backupNamePrefix) &&
          status === 'BACKUP_STATUS_SUCCESS',
      );

      if (artifact) return;

      await wait(5_000);
    }

    throw new Error(`Backup artifact for ${serviceName} was not successful in ${timeoutSeconds}s`);
  };
}
