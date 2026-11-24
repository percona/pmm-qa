import { expect, requirePmmClient, test } from '@helpers/test';
import { pmmAdminUpdateVersion } from '@helpers/versionGates';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const containerName = 'psmdb-server';
const certsDir = '/mongodb_certs';
const username = 'pmm_mongodb';
const password = '5M](Q%q/U+YQ<^m';

test.describe('TLS PSMDB pmm-admin update', { tag: '@ssl-psmdb' }, () => {
  const serviceName = 'mongo_tls_update_cli';
  const agentPassword = 'mypass';
  let serviceAdded = false;

  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'TLS PSMDB psmdb-server docker container should exist. please run pmm-framework with --database ssl_psmdb');
    await requirePmmClient(containerName, pmmAdminUpdateVersion);
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      await pmmAdmin.removeMongoService(containerName, serviceName);
      serviceAdded = false;
    }
  });

  const addService = async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb --username=${username} --password='${password}' --agent-password=${agentPassword} --host=${containerName} --port=27017 --tls --tls-skip-verify --tls-certificate-key-file=${certsDir}/client.pem ${serviceName}`);
    await output.assertSuccess();
    serviceAdded = true;
    const serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);
    const exporter = await pmmAdmin.findServiceAgent(containerName, serviceId, 'AGENT_TYPE_MONGODB_EXPORTER');
    expect(exporter, 'mongodb_exporter not found').toBeTruthy();
    await pmmAdmin.expectAgentsRunning(containerName, agentIds, true);

    return {
      serviceId, agentIds, exporterId: exporter!.agent_id,
    };
  };

  const expectMongoUp = async () => expect(async () => {
    expect(await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName), 'mongodb_exporter does not connect').toMatch(/^mongodb_up\{[^}]*\} 1$/m);
  }).toPass({ intervals: [5_000], timeout: 60_000 });

  test('PMM-T2672 - Verify pmm-admin update mongodb applies a TLS CA file and enables certificate verification', async ({}) => {
    const { serviceId, agentIds, exporterId } = await addService();
    const reports = await pmmCli.countAgentRunningReports(containerName, exporterId);

    const result = await pmmAdmin.updateServiceOk(containerName, 'mongodb', `${serviceName} --no-tls-skip-verify --tls-ca-file=${certsDir}/ca-certs.pem`);
    expect(pmmAdmin.getChangedSettings(result).sort()).toEqual(['--no-tls-skip-verify (was --tls-skip-verify)', '--tls-ca-file (new value)']);

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    expect((await pmmApi.getServerAgent(exporterId)).tls_skip_verify, 'Certificate verification is not enabled').toBe(false);

    // The exporter restarts and has to complete the TLS handshake again, now verifying the certificate against the CA.
    await expect(async () => {
      expect(await pmmCli.countAgentRunningReports(containerName, exporterId), 'pmm-agent has not restarted the exporter').toBeGreaterThan(reports);
    }).toPass({ intervals: [2_000], timeout: 60_000 });
    await pmmAdmin.expectAgentsRunning(containerName, agentIds, true);
    await expectMongoUp();
  });

  test.describe('more update flags', () => {
    const keyCopy = `/tmp/${serviceName}-client.pem`;

    test.afterEach(async ({}) => {
      await (await cli.exec(`docker exec ${containerName} rm -f ${keyCopy}`)).assertSuccess();
    });

    test('PMM-T2793 - Verify pmm-admin update mongodb changes the client certificate key file and its password', async ({}) => {
      const { exporterId } = await addService();
      await (await cli.exec(`docker exec ${containerName} cp ${certsDir}/client.pem ${keyCopy}`)).assertSuccess();

      const key = await pmmAdmin.updateServiceOk(containerName, 'mongodb', `${serviceName} --tls-certificate-key-file=${keyCopy}`);
      expect(pmmAdmin.getChangedSettings(key)).toEqual(['--tls-certificate-key-file (new value)']);
      await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
      await expectMongoUp();

      // The key of this setup is not encrypted, so the driver ignores the password; the update still has to store and hide it.
      const keyPassword = await pmmAdmin.updateServiceOk(containerName, 'mongodb', `${serviceName} --tls-certificate-key-file-password=unused-password`);
      expect(pmmAdmin.getChangedSettings(keyPassword)).toEqual(['--tls-certificate-key-file-password=*** (was empty)']);
      expect(pmmAdmin.getCurrentSettings(keyPassword)).toContain('--tls-certificate-key-file-password=***');
      await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
      await expectMongoUp();
    });

    test('PMM-T2794 - Verify pmm-admin update mongodb turns TLS off and on', async ({}) => {
      const { exporterId } = await addService();

      const off = await pmmAdmin.updateServiceOk(containerName, 'mongodb', `${serviceName} --no-tls --skip-connection-check`);
      expect(pmmAdmin.getChangedSettings(off)).toEqual(['--no-tls (was --tls)']);
      expect((await pmmApi.getServerAgent(exporterId)).tls, 'TLS is not turned off on PMM Server').toBe(false);

      const on = await pmmAdmin.updateServiceOk(containerName, 'mongodb', `${serviceName} --tls`);
      expect(pmmAdmin.getChangedSettings(on)).toEqual(['--tls (was --no-tls)']);
      expect((await pmmApi.getServerAgent(exporterId)).tls, 'TLS is not turned on on PMM Server').toBe(true);
      await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
      await expectMongoUp();
    });
  });
});
