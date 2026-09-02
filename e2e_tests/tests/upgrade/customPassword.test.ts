import pmmTest from '@fixtures/pmmTest';
import { services } from '../../testdata/externalServices';

pmmTest.describe('PMM upgrade tests for custom password', () => {
  const pgsql = { host: '127.0.0.1', password: 'pmm', port: '5432', username: 'pmm' };
  const mongo = { host: '127.0.0.1', password: 'pmmpass', port: '27017', username: 'pmm' };
  const mysql = { host: '127.0.0.1', password: 'GRgrO9301RuF', port: '3306', username: 'root' };

  for (const service of services) {
    pmmTest(
      `Adding custom agent password, custom label before upgrade at service Level for ${service.serviceType} @pre-upgrade`,
      async ({ cliHelper, credentials }) => {
        const labels = `--agent-password=uitests --custom-labels="testing=upgrade" upgrade-${service.upgradeService}`;
        const addCommand: Record<string, string> = {
          mongodb: `pmm-admin add mongodb --username=${mongo.username} --password="${mongo.password}" --port=${mongo.port} --host=${mongo.host} ${labels}`,
          mysql: `pmm-admin add mysql --password=${credentials.perconaServer.password} --port=${mysql.port} --host=${mysql.host} --query-source=perfschema ${labels}`,
          postgresql: `pmm-admin add postgresql --username=${pgsql.username} --password=${pgsql.password} --port=${pgsql.port} --host=${pgsql.host} ${labels}`,
        };

        cliHelper
          .execSilent(`docker exec ${service.connection.address} ${addCommand[service.serviceType]}`)
          .assertSuccess();
      },
    );
  }
});
