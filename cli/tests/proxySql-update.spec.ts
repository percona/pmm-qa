import { test, expect, skipWithoutUpdateCommand } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const PXC_USER = 'admin';
const PXC_PASSWORD = 'admin';
const dbHostPort = '127.0.0.1:6032';

test.describe('ProxySQL pmm-admin update', { tag: '@proxysql' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'proxysql_update_cli';
  let serviceAdded = false;

  const addService = async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add proxysql --username=${PXC_USER} --password=${PXC_PASSWORD} --port=6032 ${serviceName} ${dbHostPort}`);
    await output.assertSuccess();
    serviceAdded = true;

    return pmmAdmin.getServiceId(containerName, serviceName);
  };

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep pxc_proxysql_pmm | awk \'{print $NF}\'');
    await result.outContains('pxc_proxysql_pmm', 'PROXYSQL docker container should exist. please run pmm-framework with --database pxc');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      await pmmAdmin.removeService(containerName, 'proxysql', serviceName);
      serviceAdded = false;
    }
  });

  test('PMM-T2651 - Verify pmm-admin update proxysql changes the environment in place', async ({}) => {
    const serviceId = await addService();
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const result = await pmmAdmin.updateServiceOk(containerName, 'proxysql', `${serviceName} --environment=qa`);
    await result.outContains('ProxySQL Service updated.');
    expect(pmmAdmin.getChangedSettings(result)).toEqual(['--environment=qa (was empty)']);

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    expect((await pmmApi.getServerService(serviceId)).environment).toEqual('qa');
  });

  test.describe('flags without a case key yet', () => {
    test.beforeAll(async ({}) => {
      await skipWithoutUpdateCommand(containerName);
    });

    test('PMM-TXXXX-proxysql-collectors - Verify pmm-admin update proxysql disables and enables a collector', async ({}) => {
      const collector = '-collect.mysql_status';
      const serviceId = await addService();
      const exporterId = (await pmmAdmin.findServiceAgentId(containerName, serviceId, 'AGENT_TYPE_PROXYSQL_EXPORTER'))!;
      expect(exporterId, 'proxysql_exporter not found').toBeTruthy();
      expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The collector is not enabled by default').toContain(collector);

      const disabled = await pmmAdmin.updateServiceOk(containerName, 'proxysql', `${serviceName} --disable-collectors=mysql_status`);
      expect(pmmAdmin.getChangedSettings(disabled)).toEqual(['--disable-collectors=mysql_status (was empty)']);
      await expect(async () => {
        expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The collector is still enabled').not.toContain(collector);
      }).toPass({ intervals: [3_000], timeout: 60_000 });

      const enabled = await pmmAdmin.updateServiceOk(containerName, 'proxysql', `${serviceName} --disable-collectors=`);
      expect(pmmAdmin.getChangedSettings(enabled)).toEqual(['--disable-collectors= (was mysql_status)']);
      await expect(async () => {
        expect(await pmmCli.getExporterArgs(containerName, exporterId), 'The collector is not enabled again').toContain(collector);
      }).toPass({ intervals: [3_000], timeout: 60_000 });
    });

    test('PMM-TXXXX-proxysql-labels - Verify pmm-admin update proxysql sets and clears the cluster, replication set and custom labels', async ({}) => {
      const serviceId = await addService();

      const result = await pmmAdmin.updateServiceJson(containerName, 'proxysql', `${serviceName} --cluster=proxysql_cluster --replication-set=proxysql_rs --custom-labels=update_a=1`);
      expect(result.changes.map((change) => change.flag).sort()).toEqual(['--cluster', '--custom-labels', '--replication-set']);
      const service = await pmmApi.getServerService(serviceId);
      expect(service.cluster, 'Cluster is not changed on PMM Server').toEqual('proxysql_cluster');
      expect(service.replication_set, 'Replication set is not changed on PMM Server').toEqual('proxysql_rs');
      expect(service.custom_labels, 'Custom labels are not changed on PMM Server').toEqual({ update_a: '1' });

      await pmmAdmin.updateServiceOk(containerName, 'proxysql', `${serviceName} --cluster= --replication-set= --custom-labels=`);
      const cleared = await pmmApi.getServerService(serviceId);
      expect(cleared.cluster ?? '', 'Cluster is not cleared on PMM Server').toEqual('');
      expect(cleared.replication_set ?? '', 'Replication set is not cleared on PMM Server').toEqual('');
      expect(cleared.custom_labels ?? {}, 'Custom labels are not cleared on PMM Server').toEqual({});
    });
  });
});
