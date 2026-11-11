import Api from '@api/api';
import CliHelper from '@helpers/cli.helper';
import { ServiceType } from '@interfaces/inventory';

export interface FrameworkService {
  exporterType: string;
  name: string;
  serviceRegex: string;
}

// The services pmm-framework sets up for the inventory job, under the names the edit service tests give them.
export const frameworkServices = {
  haproxy: { exporterType: 'external-exporter', name: 'haproxy', serviceRegex: '^haproxy_pmm_service_' },
  pdpgsql: {
    exporterType: 'postgres_exporter',
    name: 'pdpgsql',
    serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$',
  },
  proxysql: { exporterType: 'proxysql_exporter', name: 'proxysql', serviceRegex: '^my-new-proxysql_' },
  ps: { exporterType: 'mysqld_exporter', name: 'ps', serviceRegex: '^ps_pmm' },
  psmdb: { exporterType: 'mongodb_exporter', name: 'psmdb', serviceRegex: '^rs101_' },
  valkey: { exporterType: 'valkey_exporter', name: 'valkey', serviceRegex: '^valkey-primary' },
} as const satisfies Record<string, FrameworkService>;

export const databaseServices: FrameworkService[] = [
  frameworkServices.pdpgsql,
  frameworkServices.ps,
  frameworkServices.psmdb,
  frameworkServices.valkey,
  frameworkServices.proxysql,
];

// A service the test registers itself in a framework service's container, and removes afterwards.
export interface OwnService {
  register: (container: string) => string;
  serviceName: string;
  serviceType: ServiceType;
  start?: (container: string) => string;
  stop?: (container: string) => string;
}

// A mongod of the test's own on 127.0.0.1, in a directory it removes again on stop.
export const ownMongod = ({
  addFlags = '',
  dir,
  mongodFlags,
  port,
  prepare,
  serviceName,
}: {
  addFlags?: string;
  dir: string;
  mongodFlags: string;
  port: number;
  prepare?: string;
  serviceName: string;
}): Required<OwnService> => ({
  register: (container) =>
    `docker exec ${container} pmm-admin add mongodb --host=127.0.0.1 --port=${port} --query-source=none ${addFlags} ${serviceName}`,
  serviceName,
  serviceType: ServiceType.mongodb,
  start: (container) =>
    `docker exec ${container} sh -c 'rm -rf ${dir} && mkdir -p ${dir} && ${prepare ? `${prepare} && ` : ''}mongod --port ${port} --bind_ip 127.0.0.1 --dbpath ${dir} --logpath ${dir}/mongod.log --fork ${mongodFlags} >/dev/null'`,
  stop: (container) =>
    `docker exec ${container} sh -c 'mongod --dbpath ${dir} --shutdown >/dev/null 2>&1; rm -rf ${dir}'`,
});

export const addOwnService = async (
  api: Api,
  cliHelper: CliHelper,
  container: string,
  ownService: OwnService,
) => {
  cliHelper.removeService(container, ownService.serviceType, ownService.serviceName);

  if (ownService.stop) cliHelper.execSilent(ownService.stop(container)).assertSuccess();
  if (ownService.start) cliHelper.execSilent(ownService.start(container)).assertSuccess();

  cliHelper.execSilent(ownService.register(container)).assertSuccess();

  return api.inventoryApi.getServiceDetailsByRegex(`^${ownService.serviceName}$`);
};
