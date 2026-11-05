import Credentials from '@helpers/credentials.helper';

export const testUser = {
  agentPassword: 'Pmm9Agent_Test4',
  password: 'Pmm9Conn_Test4',
  username: 'pmm_connection_test',
};
export const testDatabase = 'pmm_connection_test';

export interface DatabaseConnection {
  createUser: (container: string, credentials: Credentials) => string;
  dropUser: (container: string, credentials: Credentials) => string;
  // valkey_exporter has no basic auth on its metrics endpoint, so the agent password does not guard it.
  exporterAuth: boolean;
  exporterType: string;
  hasDatabase?: boolean;
  name: string;
  original: (credentials: Credentials) => { agentPassword?: string; password: string; username: string };
  serviceRegex: string;
}

const psql = (container: string, ...statements: string[]) =>
  `docker exec --user postgres ${container} psql -v ON_ERROR_STOP=1 ${statements.map((sql) => `-c "${sql}"`).join(' ')}`;
const mysql = (container: string, { perconaServer }: Credentials, sql: string) =>
  `docker exec -e MYSQL_PWD='${perconaServer.ps_84.password}' ${container} mysql -u${perconaServer.ps_84.username} -e "${sql}"`;
const mongo = (container: string, { psmdb }: Credentials, js: string) =>
  `docker exec ${container} mongo --quiet -u ${psmdb.root.username} -p ${psmdb.root.password} --authenticationDatabase admin --eval '${js}'`;
const valkeyCli = (container: string, { valkey }: Credentials, command: string) =>
  `docker exec ${container} valkey-cli -a '${valkey.password}' --no-auth-warning ${command}`;
export const serviceConnections: DatabaseConnection[] = [
  {
    createUser: (container) =>
      psql(
        container,
        `CREATE ROLE ${testUser.username} LOGIN PASSWORD '${testUser.password}' IN ROLE pg_monitor`,
        `CREATE DATABASE ${testDatabase}`,
      ),
    dropUser: (container) =>
      psql(
        container,
        `DROP DATABASE IF EXISTS ${testDatabase} WITH (FORCE)`,
        `DROP ROLE IF EXISTS ${testUser.username}`,
      ),
    exporterAuth: true,
    exporterType: 'postgres_exporter',
    hasDatabase: true,
    name: 'pdpgsql',
    original: ({ pdpgsql }) => pdpgsql,
    serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$',
  },
  {
    createUser: (container, credentials) =>
      mysql(
        container,
        credentials,
        `CREATE USER IF NOT EXISTS '${testUser.username}'@'%' IDENTIFIED BY '${testUser.password}'; GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD, BACKUP_ADMIN ON *.* TO '${testUser.username}'@'%';`,
      ),
    dropUser: (container, credentials) =>
      mysql(container, credentials, `DROP USER IF EXISTS '${testUser.username}'@'%';`),
    exporterAuth: true,
    exporterType: 'mysqld_exporter',
    name: 'ps',
    original: ({ perconaServer }) => perconaServer.ps_84,
    serviceRegex: '^ps_pmm',
  },
  {
    createUser: (container, credentials) =>
      mongo(
        container,
        credentials,
        `db.getSiblingDB("admin").createUser({ user: "${testUser.username}", pwd: "${testUser.password}", roles: [{ role: "clusterMonitor", db: "admin" }, { role: "read", db: "local" }] })`,
      ),
    dropUser: (container, credentials) =>
      mongo(container, credentials, `db.getSiblingDB("admin").dropUser("${testUser.username}")`),
    exporterAuth: true,
    exporterType: 'mongodb_exporter',
    name: 'psmdb',
    original: ({ psmdb }) => psmdb,
    serviceRegex: '^rs101_',
  },
  {
    createUser: (container, credentials) =>
      valkeyCli(
        container,
        credentials,
        `ACL SETUSER ${testUser.username} on '>${testUser.password}' '~*' '&*' '+@all'`,
      ),
    dropUser: (container, credentials) =>
      valkeyCli(container, credentials, `ACL DELUSER ${testUser.username}`),
    exporterAuth: false,
    exporterType: 'valkey_exporter',
    name: 'valkey',
    original: ({ valkey }) => valkey,
    serviceRegex: '^valkey-primary',
  },
];
