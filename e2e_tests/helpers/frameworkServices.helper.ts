import Credentials from '@helpers/credentials.helper';
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

export const psql = (container: string, ...statements: string[]) =>
  `docker exec --user postgres ${container} psql -v ON_ERROR_STOP=1 ${statements.map((sql) => `-c "${sql}"`).join(' ')}`;
export const mysql = (container: string, { perconaServer }: Credentials, sql: string, flags = '') =>
  `docker exec -e MYSQL_PWD='${perconaServer.ps_84.password}' ${container} mysql -u${perconaServer.ps_84.username} ${flags} -e "${sql}"`;
export const mongo = (container: string, { psmdb }: Credentials, js: string) =>
  `docker exec ${container} mongo --quiet -u ${psmdb.root.username} -p ${psmdb.root.password} --authenticationDatabase admin --eval '${js}'`;

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
