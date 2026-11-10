import { FrameworkService, frameworkServices } from '@helpers/frameworkServices.helper';
import Credentials from '@helpers/credentials.helper';

export const testUser = {
  agentPassword: 'Pmm9Agent_Test4',
  password: 'Pmm9Conn_Test4',
  username: 'pmm_connection_test',
};
export const testDatabase = 'pmm_connection_test';

interface DatabaseConnection extends FrameworkService {
  createUser: (container: string, credentials: Credentials) => string;
  dropUser: (container: string, credentials: Credentials) => string;
  // PMM-15898: valkey_exporter serves its metrics without basic auth, so the agent password guards nothing.
  agentPasswordEnforced: boolean;
  hasDatabase?: boolean;
  original: (credentials: Credentials) => { agentPassword?: string; password: string; username: string };
}

export const psql = (container: string, ...statements: string[]) =>
  `docker exec --user postgres ${container} psql -v ON_ERROR_STOP=1 ${statements.map((sql) => `-c "${sql}"`).join(' ')}`;
export const mysql = (container: string, { perconaServer }: Credentials, sql: string, flags = '') =>
  `docker exec -e MYSQL_PWD='${perconaServer.ps_84.password}' ${container} mysql -u${perconaServer.ps_84.username} ${flags} -e "${sql}"`;
export const mongo = (container: string, { psmdb }: Credentials, js: string) =>
  `docker exec ${container} mongo --quiet -u ${psmdb.root.username} -p ${psmdb.root.password} --authenticationDatabase admin --eval '${js}'`;
// ProxySQL keeps its admin users in one variable, which SQLite-backed admin SQL edits in place.
const proxysqlAdmin = (container: string, { proxysql }: Credentials, sql: string) =>
  `docker exec -e MYSQL_PWD='${proxysql.password}' ${container} mysql -u${proxysql.username} -h127.0.0.1 -P6032 -e "UPDATE global_variables SET ${sql} WHERE variable_name = 'admin-admin_credentials'; LOAD ADMIN VARIABLES TO RUNTIME;"`;
const proxysqlTestUser = `;${testUser.username}:${testUser.password}`;
const valkeyCli = (container: string, { valkey }: Credentials, command: string) =>
  `docker exec ${container} valkey-cli -a '${valkey.password}' --no-auth-warning ${command}`;
export const serviceConnections: DatabaseConnection[] = [
  {
    ...frameworkServices.pdpgsql,
    agentPasswordEnforced: true,
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
    hasDatabase: true,
    original: ({ pdpgsql }) => pdpgsql,
  },
  {
    ...frameworkServices.ps,
    agentPasswordEnforced: true,
    createUser: (container, credentials) =>
      mysql(
        container,
        credentials,
        `CREATE USER IF NOT EXISTS '${testUser.username}'@'%' IDENTIFIED BY '${testUser.password}'; GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD, BACKUP_ADMIN ON *.* TO '${testUser.username}'@'%';`,
      ),
    dropUser: (container, credentials) =>
      mysql(container, credentials, `DROP USER IF EXISTS '${testUser.username}'@'%';`),
    original: ({ perconaServer }) => perconaServer.ps_84,
  },
  {
    ...frameworkServices.psmdb,
    agentPasswordEnforced: true,
    createUser: (container, credentials) =>
      mongo(
        container,
        credentials,
        `db.getSiblingDB("admin").createUser({ user: "${testUser.username}", pwd: "${testUser.password}", roles: [{ role: "clusterMonitor", db: "admin" }, { role: "read", db: "local" }] })`,
      ),
    dropUser: (container, credentials) =>
      mongo(container, credentials, `db.getSiblingDB("admin").dropUser("${testUser.username}")`),
    original: ({ psmdb }) => psmdb,
  },
  {
    ...frameworkServices.valkey,
    agentPasswordEnforced: false,
    createUser: (container, credentials) =>
      valkeyCli(
        container,
        credentials,
        `ACL SETUSER ${testUser.username} on '>${testUser.password}' '~*' '&*' '+@all'`,
      ),
    dropUser: (container, credentials) =>
      valkeyCli(container, credentials, `ACL DELUSER ${testUser.username}`),
    original: ({ valkey }) => valkey,
  },
  {
    ...frameworkServices.proxysql,
    agentPasswordEnforced: true,
    createUser: (container, credentials) =>
      proxysqlAdmin(container, credentials, `variable_value = variable_value || '${proxysqlTestUser}'`),
    dropUser: (container, credentials) =>
      proxysqlAdmin(
        container,
        credentials,
        `variable_value = replace(variable_value, '${proxysqlTestUser}', '')`,
      ),
    original: ({ proxysql }) => proxysql,
  },
];
