import Api from '@api/api';
import CliHelper from '@helpers/cli.helper';
import DockerHelper from '@helpers/docker.helper';
import { AddServiceResponse } from '@interfaces/inventory';

export interface RemoteDatabase {
  credentials?: Record<string, string>;
  dockerArgs: string;
  port: number;
  type: keyof AddServiceResponse;
}

export interface MonitoredDatabase {
  name: string;
  serviceId: string;
}

const password = 'qa-advisors';

export const remoteMongodb = (dockerArgs: string): RemoteDatabase => ({
  dockerArgs,
  port: 27_017,
  type: 'mongodb',
});

export const remoteMysql = (
  dockerArgs: string,
  passwordVariable = 'MYSQL_ROOT_PASSWORD',
): RemoteDatabase => ({
  credentials: { password, username: 'root' },
  dockerArgs: `-e ${passwordVariable}=${password} ${dockerArgs}`,
  port: 3_306,
  type: 'mysql',
});

export const remotePostgresql = (image: string): RemoteDatabase => ({
  credentials: { password, username: 'postgres' },
  dockerArgs: `-e POSTGRES_PASSWORD=${password} ${image}`,
  port: 5_432,
  type: 'postgresql',
});

export default class RemoteDatabasesHelper {
  private readonly containers: string[] = [];
  private readonly nodeIds: string[] = [];

  constructor(
    private readonly api: Api,
    private readonly cliHelper: CliHelper,
    private readonly dockerHelper: DockerHelper,
  ) {}

  // The Service filter of Insights matches substrings, so the shared suffix keeps one name from matching another.
  add = async <T extends string>(
    databases: Record<T, RemoteDatabase>,
  ): Promise<Record<T, MonitoredDatabase>> => {
    const suffix = Date.now();
    const entries = Object.entries(databases) as [T, RemoteDatabase][];
    const monitored = {} as Record<T, MonitoredDatabase>;

    for (const [key, { dockerArgs }] of entries) {
      const name = `qa-${key}-${suffix}`;

      this.containers.push(name);
      this.dockerHelper.startContainer(name, dockerArgs);
    }

    for (const [key, { credentials, port, type }] of entries) {
      const name = `qa-${key}-${suffix}`;
      const service = await this.api.managementApi.addRemoteDatabase(type, name, port, credentials);

      this.nodeIds.push(service.node_id);
      monitored[key] = { name, serviceId: service.service_id };
    }

    return monitored;
  };

  removeAll = async () => {
    const failures: string[] = [];

    for (const nodeId of this.nodeIds.splice(0)) {
      try {
        await this.api.inventoryApi.deleteNode(nodeId, true);
      } catch (error) {
        failures.push(`node ${nodeId}: ${error}`);
      }
    }

    for (const container of this.containers.splice(0)) {
      try {
        this.cliHelper.removeContainer(container);
      } catch (error) {
        failures.push(`container ${container}: ${error}`);
      }
    }

    if (failures.length > 0) throw new Error(`Cleanup failed:\n${failures.join('\n')}`);
  };
}
