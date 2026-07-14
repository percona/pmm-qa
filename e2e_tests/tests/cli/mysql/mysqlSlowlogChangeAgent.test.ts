import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import fs from 'node:fs';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const mysqlPassword = 'GRgrO9301RuF';
  const newUsername = 'new_pmmm_username';
  const newPassword = 'new_pmm_user_password';
  let containerName: string;
  let serviceName: string;
  let serviceId: string;
  let mysqldExporterId: string;
  let mysqldSlowlogAgentId: string;
  let pgExporterPort: string;
  const pgExporterPassword = 'newAgentPassword';

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep ps_pmm_`).stdout.trim();
    console.log(`Container name is: ${containerName}`);
    // pgVersion = containerName.match(/\d+/)?.[0] ?? '';
    serviceName = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ps_pmm | head -1 | awk -F' ' '{print $2}'`,
      )
      .stdout.trim();
    serviceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ps_pmm | head -1 | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    mysqldExporterId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mysqld_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    mysqldSlowlogAgentId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep mysql_slowlog_agent | awk -F' ' '{print $3}'`,
      )
      .stdout.trim();
  });

  pmmTest(
    'PMM-T9991 - Verify Change agent username and password @ps-slowlog-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "CREATE USER '${newUsername}'@'localhost' IDENTIFIED BY '${newPassword}-wrong'; GRANT ALL PRIVILEGES ON *.* TO '${newUsername}'@'localhost'; FLUSH PRIVILEGES;"`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --password=${newPassword} --username=${newUsername}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-slowlog-agent ${mysqldSlowlogAgentId} --password=${newPassword} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).outContains('Access denied for user'));

      cliHelper.execSilent(
        `docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "ALTER USER '${newUsername}'@'localhost' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;"`,
      );

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T99922 - Verify Change agent custom labels @ps-slowlog-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const customLabel = 'env=qa_testing_mysqld_exporter';
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --custom-labels=${customLabel}`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-slowlog-agent ${mysqldSlowlogAgentId} --custom-labels=${customLabel}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(mysqldExporterId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
      await agentsPage.hideRowDetails(mysqldExporterId);
      await agentsPage.showRowDetails(mysqldSlowlogAgentId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
      await agentsPage.hideRowDetails(mysqldSlowlogAgentId);
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent log level @ps-slowlog-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --log-level=debug`,
        `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-slowlog-agent ${mysqldSlowlogAgentId} --log-level=debug`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(mysqldExporterId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
      await agentsPage.hideRowDetails(mysqldExporterId);
      await agentsPage.showRowDetails(mysqldSlowlogAgentId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
      await agentsPage.hideRowDetails(mysqldSlowlogAgentId);
    },
  );

  pmmTest('PMM-T9993 - Verify Change agent debug, trace and json @ps-slowlog-integration', async ({ cliHelper }) => {
    const commands = [
      `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --debug --trace --json`,
      `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-slowlog-agent ${mysqldSlowlogAgentId} --debug --trace --json`,
    ];

    commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
  });



  pmmTest(
    'PMM-T9995 - Verify Change agent enable true/false @ps-slowlog-integration',
    async ({ cliHelper, page }) => {
      const enableCommands = [
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable=true', response: '- enabled agent', status: 'Running' },
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable', response: '- enabled agent', status: 'Running' },
      ];

      for (const enableCommand of enableCommands) {
        let commands = [
          `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} ${enableCommand.command}`,
          `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-slowlog-agent ${mysqldSlowlogAgentId} ${enableCommand.command}`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).assertSuccess().outContains(enableCommand.response);
        }

        await page.waitForTimeout(Timeouts.TEN_SECONDS);

        commands = [
          `docker exec ${containerName} pmm-admin list | grep mysqld_exporter | grep ${serviceId}`,
          `docker exec ${containerName} pmm-admin list | grep mysql_slowlog_agent | grep ${serviceId}`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).assertSuccess().outContains(enableCommand.status);
        }
      }
    },
  );

  pmmTest('PMM-T9996 - Verify Change agent agent password @ps-integration', async ({ cliHelper, page }) => {
    cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --agent-password=${pgExporterPassword}`,
    );

    // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
    await page.waitForTimeout(Timeouts.TEN_SECONDS);

    const metrics = cliHelper.getMetrics({
      agentPassword: pgExporterPassword,
      dockerContainer: containerName,
      serviceName: serviceName,
    });

    expect(metrics).toContain('mysql_up');
  });

  pmmTest('PMM-T9993 - Verify Change agent expose exporter @ps-integration', async ({ cliHelper, page }) => {
    pgExporterPort = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${mysqldExporterId} | awk -F' ' '{print $6}'`,
      )
      .stdout.trim();
    await cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --expose-exporter`,
      )
      .assertSuccess()
      .outContains('- enabled expose exporter');
    // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
    await page.waitForTimeout(Timeouts.FIVE_SECONDS);
    await cliHelper
      .execSilent(
        `docker exec pmm-server curl -u pmm:${pgExporterPassword} http://${containerName}:${pgExporterPort}/metrics`,
      )
      .assertSuccess()
      .outContains('mysql_up');
  });

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
      .outContains('mysql_up');
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
    'PMM-T9994 - Verify Change agent tls @ps-slowlog-integration',
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
        `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-slowlog-agent ${mysqldSlowlogAgentId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command));
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest('PMM-T9993 - Verify Change agent pmm agent listen port @ps-slowlog-integration', async ({ cliHelper }) => {
    let commands = [
      `docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
      `docker restart ${containerName}`,
      `docker exec -d ${containerName} pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`,
    ];

    commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

    commands = [
      `docker exec ${containerName} pmm-admin inventory change agent mysqld-exporter ${mysqldExporterId} --pmm-agent-listen-port=7778`,
      `docker exec ${containerName} pmm-admin inventory change agent qan-mysql-slowlog-agent ${mysqldSlowlogAgentId} --pmm-agent-listen-port=7778`,
    ];

    commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
  });
});
