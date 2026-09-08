import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import fs from 'node:fs';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const valkeyPort = '6379';
  const valkeyPassword = 'VKvl41568AsE';
  const newUsername = 'new_pmmm_username';
  const newPassword = 'new_pmm_user_password';
  let containerName: string;
  let serviceName: string;
  let serviceId: string;
  let valkeyExporterId: string;
  let pgExporterPort: string;
  const pgExporterPassword = 'newAgentPassword';

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper
      .execSilent(`docker ps --format '{{.Names}}' | grep valkey-primary-1`)
      .stdout.trim();
    console.log(`Container name is: ${containerName}`);
    // pgVersion = containerName.match(/\d+/)?.[0] ?? '';
    serviceName = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep valkey-primary | head -1 | awk -F' ' '{print $2}'`,
      )
      .stdout.trim();
    console.log(`Service name is: ${serviceName}`);
    serviceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep valkey | head -1 | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    console.log(`Service ID is: ${serviceId}`);
    valkeyExporterId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep valkey_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    console.log(`Valkey exporter id is: ${valkeyExporterId}`);
  });

  pmmTest(
    'PMM-T9991 - Verify Change agent username and password @valkey-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} valkey-cli -h 127.0.0.1 -p ${valkeyPort} -a ${valkeyPassword} ACL SETUSER ${newUsername} on '${newPassword}-wrong' '~*' '&*' +@all`,
        )
        .assertSuccess();

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --password=${newPassword} --username=${newUsername}`,
        )
        .outContains('invalid username-password pair or user is disabled');

      cliHelper
        .execSilent(
          `docker exec ${containerName} valkey-cli -h 127.0.0.1 -p ${valkeyPort} -a ${valkeyPassword} ACL SETUSER ${newUsername} on '>${newPassword}' '~*' '&*' +@all`,
        )
        .assertSuccess();
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --password=${newPassword} --username=${newUsername}`,
        )
        .assertSuccess();

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T99922 - Verfiy Change agent custom labels @valkey-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const customLabel = 'env=qa_testing_valkey_exporter';

      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --custom-labels=${customLabel}`,
        )
        .assertSuccess();
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(valkeyExporterId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
      await agentsPage.hideRowDetails(valkeyExporterId);
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent log level @valkey-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --log-level=debug`,
        )
        .assertSuccess();
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(valkeyExporterId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
      await agentsPage.hideRowDetails(valkeyExporterId);
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent debug, trace and json @valkey-integration',
    async ({ cliHelper }) => {
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --debug --trace --json`,
        )
        .assertSuccess();
    },
  );

  // eslint-disable-next-line playwright/no-skipped-test -- Bug in the PMM
  pmmTest.skip(
    'PMM-T9994 - Verify Change agent tls @valkey-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      const confPath = `/usr/local/etc/valkey/valkey.conf`;

      cliHelper.createTlsCertificates(containerName);

      let commands = [
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/private/${containerName}.key /certs/${containerName}.key`,
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/issued/${containerName}.crt /certs/${containerName}.crt`,
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/private/pmm-test.key > /certs/client.key"`,
        `docker exec ${containerName} bash -c "cat /easy-rsa/easyrsa3/pki/issued/pmm-test.crt > /certs/client.crt"`,
        `docker exec ${containerName} cp /easy-rsa/easyrsa3/pki/ca.crt /certs/ca-certs.pem`,
        `docker exec ${containerName} chown 999:999 /certs/valkey-primary-1.crt`,
        `docker exec ${containerName} chown 999:999 /certs/valkey-primary-1.key`,
        `docker exec ${containerName} chmod 600 /certs/${containerName}.key`,
        `docker exec ${containerName} chmod 644 /certs/${containerName}.crt`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      fs.writeFileSync(
        '/tmp/ssl.conf',
        `tls-port 6379\nport 0\ntls-cert-file /certs/${containerName}.crt\ntls-key-file /certs/${containerName}.key\ntls-ca-cert-file /certs/${containerName}.crt\ntls-auth-clients yes\ntls-replication yes\ntls-cluster yes`,
      );

      cliHelper.execSilent(`docker cp /tmp/ssl.conf ${containerName}:/tmp/ssl.conf`);
      console.log(
        cliHelper.execSilent(`docker exec ${containerName} bash -c "cat /tmp/ssl.conf >> ${confPath}"`),
      );
      console.log(cliHelper.execSilent(`docker exec ${containerName} cat ${confPath}`));
      cliHelper.execSilent(`docker restart ${containerName}`).assertSuccess();
      console.log(
        cliHelper.execSilent(
          `docker exec -d ${containerName} pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`,
        ),
      );

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Down', Timeouts.TWO_MINUTES);

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --tls-cert-file=/certs/client.crt --tls-key-file=/certs/client.key --tls-ca-file=/certs/ca-certs.pem --tls --tls-skip-verify`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command));
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T9995 - Verify Change agent enable true/false @valkey-integration',
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
            `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} ${enableCommand.command}`,
          )
          .assertSuccess()
          .outContains(enableCommand.response);
        // docker exec valkey-primary-1 pmm-admin inventory change agent valkey-exporter d3104b77-2dbe-44d7-823d-86fd37951952 --enable=true
        // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for the agents to be enabled/disabled
        await page.waitForTimeout(Timeouts.TEN_SECONDS);

        console.log(enableCommand.command);
        console.log(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} ${enableCommand.command}`,
        );

        await cliHelper
          .execSilent(
            `docker exec ${containerName} pmm-admin list | grep valkey_exporter | grep ${serviceId}`,
          )
          .outContains(enableCommand.status);
      }
    },
  );

  pmmTest(
    'PMM-T9996 - Verify Change agent agent password @valkey-integration',
    async ({ cliHelper, page }) => {
      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --agent-password=${pgExporterPassword}`,
      );

      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.TEN_SECONDS);

      const metrics = cliHelper.getMetrics({
        agentPassword: pgExporterPassword,
        dockerContainer: containerName,
        serviceName: serviceName,
      });

      expect(metrics).toContain('redis_up');
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent expose exporter @valkey-integration',
    async ({ cliHelper, page }) => {
      pgExporterPort = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${valkeyExporterId} | awk -F' ' '{print $6}'`,
        )
        .stdout.trim();
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --expose-exporter`,
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
        .outContains('redis_up');
    },
  );

  pmmTest('PMM-T9993 - Verify Change agent push metrics @valkey-integration', async ({ cliHelper, page }) => {
    pgExporterPort = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${valkeyExporterId} | awk -F' ' '{print $6}'`,
      )
      .stdout.trim();
    await cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --push-metrics`,
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
      .outContains('redis_up');
    await cliHelper
      .execSilent(
        `docker exec ${containerName} cat /var/log/pmm-agent.log | grep vmagent | tail -20 | grep error`,
      )
      .outEquals('');
    await cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep ${valkeyExporterId}`)
      .outContains('Running');
  });

  pmmTest(
    'PMM-T9993 - Verify Change agent disable collectors @valkey-integration',
    async ({ api, cliHelper }) => {
      const collectorsToDisable = ['config', 'latency'];

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --disable-collectors=${collectorsToDisable.join(',')}`,
        )
        .assertSuccess()
        .outContains(`- updated disabled collectors: [${collectorsToDisable.join(' ')}]`);

      const agent = await api.inventoryApi.getAgentById(valkeyExporterId);

      expect(
        agent.disabled_collectors,
        'Disabled collectors were not persisted on the valkey exporter agent',
      ).toEqual(collectorsToDisable);
    },
  );

  pmmTest(
    'PMM-T1013 - Verify Change agent skip connection check @valkey-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --password=invalid_skip_check_password --skip-connection-check`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess().outContains('agent configuration updated.');
      }

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --username=${newUsername} --password=${newPassword}`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess();
      }

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T9993 - Verify Change agent pmm agent listen port @valkey-integration',
    async ({ cliHelper }) => {
      const commands = [
        `docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
        `docker restart ${containerName}`,
        `docker exec -d ${containerName} pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --pmm-agent-listen-port=7778`,
        )
        .assertSuccess();
    },
  );

  pmmTest(
    'PMM-T99103 - Verify Change agent server url and server insecure tls @valkey-integration',
    async ({ cliHelper }) => {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
      const serverUrl = `https://admin:${adminPassword}@pmm-server:8443/`;
      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --server-url=${serverUrl}`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).outContains('tls: failed to verify certificate:');
      }

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${valkeyExporterId} --server-url=${serverUrl} --server-insecure-tls`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess().outContains('agent configuration updated.');
      }
    },
  );
});
