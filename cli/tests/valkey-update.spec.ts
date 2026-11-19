import { test, expect, skipWithoutUpdateCommand } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const containerName = 'valkey-primary-1';
const port = '6379';
const username = 'default';
const password = 'VKvl41568AsE';

test.describe('Valkey pmm-admin update', { tag: '@valkey' }, () => {
  test.use({ pmmClientContainer: containerName });

  const serviceName = 'valkey_update_cli';
  let serviceAdded = false;

  const addService = async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add valkey --username=${username} --password="${password}" --service-name=${serviceName} --host=${containerName} --port=${port}`);
    await output.assertSuccess();
    serviceAdded = true;

    return pmmAdmin.getServiceId(containerName, serviceName);
  };

  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'Valkey valkey-primary-1 docker container should exist. please run pmm-framework with --database valkey');
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      await pmmAdmin.removeService(containerName, 'valkey', serviceName);
      serviceAdded = false;
    }
  });

  test('PMM-T2652 - Verify pmm-admin update valkey changes the log level in place', async ({}) => {
    const serviceId = await addService();
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);
    const exporter = await pmmAdmin.findServiceAgent(containerName, serviceId, 'AGENT_TYPE_VALKEY_EXPORTER');
    expect(exporter, 'valkey_exporter not found').toBeTruthy();

    const result = await pmmAdmin.updateServiceOk(containerName, 'valkey', `${serviceName} --log-level=debug`);
    await result.outContains('Valkey Service updated.');
    expect(pmmAdmin.getChangedSettings(result)).toEqual([expect.stringMatching(/^--log-level=debug \(was .+\)$/)]);

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    await expect(async () => {
      expect(await pmmCli.getExporterArgs(containerName, exporter!.agent_id)).toContain('--log-level=debug');
    }).toPass({ intervals: [3_000], timeout: 60_000 });
  });

  test.describe('flags without a case key yet', () => {
    test.beforeAll(async ({}) => {
      await skipWithoutUpdateCommand(containerName);
    });

    test('PMM-TXXXX-valkey-labels - Verify pmm-admin update valkey sets and clears the labels', async ({}) => {
      const serviceId = await addService();

      const result = await pmmAdmin.updateServiceJson(containerName, 'valkey', `${serviceName} --environment=qa --cluster=valkey_cluster --replication-set=valkey_rs --custom-labels=update_a=1`);
      expect(result.changes.map((change) => change.flag).sort()).toEqual(['--cluster', '--custom-labels', '--environment', '--replication-set']);
      const service = await pmmApi.getServerService(serviceId);
      expect(service.environment, 'Environment is not changed on PMM Server').toEqual('qa');
      expect(service.cluster, 'Cluster is not changed on PMM Server').toEqual('valkey_cluster');
      expect(service.replication_set, 'Replication set is not changed on PMM Server').toEqual('valkey_rs');
      expect(service.custom_labels, 'Custom labels are not changed on PMM Server').toEqual({ update_a: '1' });

      await pmmAdmin.updateServiceOk(containerName, 'valkey', `${serviceName} --custom-labels=`);
      expect((await pmmApi.getServerService(serviceId)).custom_labels ?? {}, 'Custom labels are not cleared on PMM Server').toEqual({});
    });

    test('PMM-TXXXX-valkey-tls-files - Verify pmm-admin update valkey stores the TLS flags and files', async ({}) => {
      const serviceId = await addService();
      const exporterId = (await pmmAdmin.findServiceAgentId(containerName, serviceId, 'AGENT_TYPE_VALKEY_EXPORTER'))!;
      const certificate = await pmmCli.createSelfSignedCertificate(containerName, 'valkey_update_tls');

      // This setup has no TLS server, so the connection check is skipped: the test covers what the update sends, not the handshake.
      try {
        const output = await pmmAdmin.updateServiceOk(
          containerName,
          'valkey',
          `${serviceName} --tls --tls-skip-verify --tls-ca=${certificate.cert} --tls-cert=${certificate.cert} --tls-key=${certificate.key} --skip-connection-check`,
        );
        expect(pmmAdmin.getChangedSettings(output).sort()).toEqual([
          '--tls (was --no-tls)',
          '--tls-ca (new value)',
          '--tls-cert (new value)',
          '--tls-key (new value)',
          '--tls-skip-verify (was --no-tls-skip-verify)',
        ]);
        expect((await pmmApi.getServerAgent(exporterId)).tls, 'TLS is not turned on on PMM Server').toBe(true);
      } finally {
        await (await cli.exec(`docker exec ${containerName} rm -rf ${certificate.dir}`)).assertSuccess();
      }
    });
  });
});
