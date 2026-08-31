import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const mysqlPassword = 'admin';
  const newUsername = 'new_pmmm_username';
  const newPassword = 'new_pmm_user_password';
  let containerName: string;
  let serviceName: string;
  let serviceId: string;
  let proxysqlExporterId: string;
  let proxysqlExporterPort: string;
  const proxysqlExporterPassword = 'newAgentPassword';

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep pxc_proxysql`).stdout.trim();
    console.log(`Container name is: ${containerName}`);
    serviceName = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep pxc_proxysql_pmm | head -1 | awk -F' ' '{print $2}'`,
      )
      .stdout.trim();
    console.log(`Service Name is: ${serviceName}`);
    serviceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep pxc_proxysql_pmm | head -1 | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    console.log(`Service Id is: ${serviceId}`);
    proxysqlExporterId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep proxysql_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    console.log(`Exporter id is: ${proxysqlExporterId}`);
  });

  pmmTest(
    'PMM-T9991 - Verify Change agent username and password @proxysql-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} mysql -h127.0.0.1 -P6032 -uadmin -p${mysqlPassword} -e "INSERT INTO mysql_users (username, password) VALUES ('${newUsername}', '${newPassword}-wrong'); LOAD MYSQL USERS TO RUNTIME; SAVE MYSQL USERS TO DISK;"`,
        )
        .assertSuccess();

      console.log(
        `docker exec ${containerName} pmm-admin inventory change agent proxysql-exporter ${proxysqlExporterId} --password=${newPassword} --username=${newUsername}`,
      );

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent proxysql-exporter ${proxysqlExporterId} --password=${newPassword} --username=${newUsername}`,
        )
        .outContains('Access denied for user');

      cliHelper.execSilent(
        `docker exec ${containerName} mysql -h127.0.0.1 -P6032 -uadmin -p${mysqlPassword} -e "INSERT INTO mysql_users (username, password) VALUES ('${newUsername}', '${newPassword}'); LOAD MYSQL USERS TO RUNTIME; SAVE MYSQL USERS TO DISK;"`,
      );

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  // eslint-disable-next-line playwright/no-commented-out-tests -- Developing tests
  /* pmmTest(
    'PMM-T99922 - Verify Change agent custom labels @ps-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const customLabel = 'env=qa_testing_mysqld_exporter';
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --custom-labels=${customLabel}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-perfschema-agent ${mysqldPerfschemaAgentId} --custom-labels=${customLabel}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(mysqldExporterId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
      await agentsPage.hideRowDetails(mysqldExporterId);
      await agentsPage.showRowDetails(mysqldPerfschemaAgentId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
      await agentsPage.hideRowDetails(mysqldPerfschemaAgentId);
    },
  );*/

  pmmTest(
    'PMM-T9993 - Verify Change agent log level @proxysql-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent proxysql-exporter ${proxysqlExporterId} --log-level=debug`,
        )
        .assertSuccess();

      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(proxysqlExporterId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent debug, trace and json @proxysql-integration',
    async ({ cliHelper }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent proxysql-exporter ${proxysqlExporterId} --debug --trace --json`,
        )
        .assertSuccess();
    },
  );

  pmmTest(
    'PMM-T9995 - Verify Change agent enable true/false @proxysql-integration',
    async ({ cliHelper, page }) => {
      const enableCommands = [
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable=true', response: '- enabled agent', status: 'Running' },
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable', response: '- enabled agent', status: 'Running' },
      ];

      for (const enableCommand of enableCommands) {
        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin inventory change agent proxysql-exporter ${proxysqlExporterId} ${enableCommand.command}`,
          )
          .assertSuccess()
          .outContains(enableCommand.response);

        // eslint-disable-next-line playwright/no-wait-for-timeout -- Developing tests
        await page.waitForTimeout(Timeouts.TEN_SECONDS);

        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin list | grep proxysql_exporter | grep ${serviceId}`,
          )
          .assertSuccess()
          .outContains(enableCommand.status);
      }
    },
  );

  pmmTest('PMM-T9996 - Verify Change agent password @proxysql-integration', async ({ cliHelper, page }) => {
    cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin inventory change agent proxysql-exporter ${proxysqlExporterId} --agent-password=${proxysqlExporterPassword}`,
    );

    // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
    await page.waitForTimeout(Timeouts.TEN_SECONDS);

    const metrics = cliHelper.getMetrics({
      agentPassword: proxysqlExporterPassword,
      dockerContainer: containerName,
      serviceName: serviceName,
    });

    expect(metrics).toContain('proxysql_up');
  });

  pmmTest(
    'PMM-T9993 - Verify Change agent expose exporter @proxysql-integration',
    async ({ cliHelper, page }) => {
      proxysqlExporterPort = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${proxysqlExporterId} | awk -F' ' '{print $6}'`,
        )
        .stdout.trim();
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent proxysql-exporter ${proxysqlExporterId} --expose-exporter`,
        )
        .assertSuccess()
        .outContains('- enabled expose exporter');
      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.TEN_SECONDS);
      await cliHelper
        .execSilent(
          `docker exec pmm-server curl -u pmm:${proxysqlExporterPassword} http://${containerName}:${proxysqlExporterPort}/metrics`,
        )
        .assertSuccess()
        .outContains('proxysql_up');
    },
  );
  // eslint-disable-next-line playwright/no-commented-out-tests -- Developing tests
  /*
  pmmTest('PMM-T9993 - Verify Change agent push metrics @ps-integration', async ({ cliHelper, page }) => {
    pgExporterPort = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${mysqldExporterId} | awk -F' ' '{print $6}'`,
      )
      .stdout.trim();
    await cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --push-metrics`,
      )
      .assertSuccess()
      .outContains('- enabled push metrics');

    // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
    await page.waitForTimeout(Timeouts.FIVE_SECONDS);
    await cliHelper
      .execSilent(
        `docker exec pmm-server curl -u pmm:${pgExporterPassword} http://${containerName}:${pgExporterPort}/metrics`,
      )
      .assertSuccess()
      .outContains('proxysql_up');
    await cliHelper
      .execSilent(
        `docker exec ${containerName} cat /var/log/pmm-agent.log | grep vmagent | tail -20 | grep error`,
      )
      .outEquals('');
    await cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep ${mysqldExporterId}`)
      .outContains('Running');
  });

  pmmTest('PMM-T9993 - Verify Change agent disable collectors @ps-integration', async ({ cliHelper }) => {
    await cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --disable-collectors=stat_statements,locks`,
      )
      .assertSuccess()
      .outContains('- updated disabled collectors: [stat_statements locks]');
  });

  pmmTest(
    'PMM-T9994 - Verify Change agent tls @ps-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      const confPath = `/etc/mysql/mysql.conf.d/mysqld.cnf`;

      cliHelper.createTlsCertificates(containerName);

      let commands = [
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/private/${containerName}.key /certs/${containerName}.key`,
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/issued/${containerName}.crt /certs/${containerName}.crt`,
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/private/pmm-test.key > /certs/client.key"`,
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/issued/pmm-test.crt > /certs/client.crt"`,
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/ca.crt /certs/ca-certs.pem`,
        `docker exec ${containerName} chown 999:999 /certs/${containerName}.crt`,
        `docker exec ${containerName} chown 999:999 /certs/${containerName}.key`,
        `docker exec ${containerName} chmod 600 /certs/${containerName}.key`,
        `docker exec ${containerName} chmod 644 /certs/${containerName}.crt`,
      ];

      commands.forEach((command) => console.log(cliHelper.execSilent(command).assertSuccess()));

      fs.writeFileSync(
        '/tmp/ssl.conf',
        `ssl-ca=/certs/ca-certs.pem\nssl-cert=/certs/${containerName}.crt\nssl-key=/certs/${containerName}.key\nrequire_secure_transport=ON`,
      );

      cliHelper.execSilent(`docker cp /tmp/ssl.conf ${containerName}:/tmp/ssl.conf`);
      console.log(
        cliHelper.execSilent(`docker exec ${containerName} bash -c "cat /tmp/ssl.conf >> ${confPath}"`),
      );
      console.log(cliHelper.execSilent(`docker exec ${containerName} cat ${confPath}`));
      console.log(
        cliHelper.execSilent(`docker exec ${containerName} systemctl restart mysql`).assertSuccess(),
      );

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Down', Timeouts.TWO_MINUTES);

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-perfschema-agent ${mysqldPerfschemaAgentId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command));
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest('PMM-T9993 - Verify Change agent pmm agent listen port @ps-integration', async ({ cliHelper }) => {
    let commands = [
      `docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
      `docker restart ${containerName}`,
      `docker exec -d ${containerName} pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`,
    ];

    commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

    commands = [
      `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --pmm-agent-listen-port=7778`,
      `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-perfschema-agent ${mysqldPerfschemaAgentId} --pmm-agent-listen-port=7778`,
    ];

    commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
  });*/
});
