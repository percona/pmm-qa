import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import Credentials from '@helpers/credentials.helper';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const testUser = {
  agentPassword: 'Pmm9Agent_Test4',
  password: 'Pmm9Conn_Test4',
  username: 'pmm_connection_test',
};
const testDatabase = 'pmm_connection_test';

interface DatabaseConnection {
  createUser: (container: string, credentials: Credentials) => string;
  dropUser: (container: string, credentials: Credentials) => string;
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
const databases: DatabaseConnection[] = [
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
    exporterType: 'valkey_exporter',
    name: 'valkey',
    original: ({ valkey }) => valkey,
    serviceRegex: '^valkey-primary',
  },
];

for (const { createUser, dropUser, exporterType, hasDatabase, name, original, serviceRegex } of databases) {
  pmmTest.describe(`Edit service connection | ${name}`, () => {
    let service: GetService;
    let container: string;

    const getCurrentService = async (api: Api) => {
      const current = (await api.inventoryApi.getServices()).services.find(
        ({ service_id }) => service_id === service.service_id,
      );

      if (!current) throw new Error(`${service.service_name} is not present`);

      return current;
    };

    const getExporter = async (api: Api) => {
      const exporter = (await getCurrentService(api)).agents.find(
        ({ agent_type }) => agent_type === exporterType,
      );

      if (!exporter) throw new Error(`${exporterType} of ${service.service_name} is not present`);

      return exporter;
    };

    pmmTest.beforeEach(async ({ api, cliHelper, credentials, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      container = await api.inventoryApi.getNodeAddress(service.node_id);
      cliHelper.execSilent(dropUser(container, credentials));
      cliHelper.execSilent(createUser(container, credentials)).assertSuccess();
    });

    pmmTest.afterEach(async ({ api, cliHelper, credentials }) => {
      const { agentPassword, password, username } = original(credentials);
      const exporter = await getExporter(api);

      // Without a custom agent password the exporter's endpoint takes its agent ID.
      await api.inventoryApi.updateService(service.service_id, service.service_type, {
        agent_password: agentPassword ?? exporter.agent_id,
        password,
        username,
        ...(hasDatabase && { database: service.database_name }),
      });
      cliHelper.execSilent(dropUser(container, credentials)).assertSuccess();
    });

    pmmTest(
      `PMM-15674 - Verify Connection section shows the current settings and hides passwords for ${name} service @inventory`,
      async ({ api, editServicePage }) => {
        const exporter = await getExporter(api);

        await editServicePage.open(service.service_id);
        await editServicePage.verifyConnection({
          database: hasDatabase ? service.database_name : undefined,
          username: exporter.username,
        });
        await expect(editServicePage.inputs.database).toBeVisible({ visible: !!hasDatabase });
        await expect(editServicePage.buttons.saveChanges).toBeDisabled();
      },
    );

    pmmTest(
      `PMM-15674 - Verify changing database, username, password and agent password of ${name} service @inventory`,
      async ({ api, cliHelper, editServicePage, page }) => {
        const connection = { ...testUser, database: hasDatabase ? testDatabase : undefined };

        await editServicePage.open(service.service_id);
        await editServicePage.editConnection(connection);

        const response = await editServicePage.saveChanges(service.service_id, false, true);

        expect(response.status(), await response.text()).toEqual(200);
        await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));

        await expect
          .poll(
            async () => {
              const { database_name } = await getCurrentService(api);
              const { is_agent_password_set, status, username } = await getExporter(api);

              return { database_name, is_agent_password_set, status, username };
            },
            { message: `${exporterType} after connection edit`, timeout: Timeouts.ONE_MINUTE },
          )
          .toEqual({
            database_name: hasDatabase ? testDatabase : service.database_name,
            is_agent_password_set: true,
            status: AgentStatus.running,
            username: testUser.username,
          });

        const { listen_port } = await getExporter(api);
        const metricsStatus = (agentPassword: string) =>
          cliHelper
            .execSilent(
              `docker exec ${container} curl -s -o /dev/null -w '%{http_code}' -u 'pmm:${agentPassword}' http://127.0.0.1:${listen_port}/metrics`,
            )
            .stdout.trim();

        expect(metricsStatus(testUser.agentPassword), 'exporter accepts the new agent password').toEqual(
          '200',
        );
        expect(metricsStatus('wrong-agent-password'), 'exporter rejects another agent password').toEqual(
          '401',
        );

        await editServicePage.open(service.service_id);
        await editServicePage.verifyConnection(connection);
      },
    );

    pmmTest(
      `PMM-15674 - Verify wrong password is rejected by the connection check for ${name} service @inventory`,
      async ({ api, credentials, editServicePage, page }) => {
        const { username } = original(credentials);

        await editServicePage.open(service.service_id);
        await editServicePage.editConnection({ password: 'wrong-password', username: testUser.username });

        const response = await editServicePage.saveChanges(service.service_id, false, true);

        expect(response.status(), 'connection check fails with a wrong password').not.toEqual(200);
        await expect(page).toHaveURL(new RegExp(`${service.service_id}/edit$`));
        expect((await getExporter(api)).username, 'stored username is unchanged').toEqual(username);
      },
    );
  });
}
