import { expect, requirePmmClient, test } from '@helpers/test';
import { pmmAdminUpdateVersion } from '@helpers/versionGates';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const PXC_USER = 'admin';
const PXC_PASSWORD = 'admin';
const dbHostPort = '127.0.0.1:6032';

test.describe('ProxySQL pmm-admin update', { tag: '@proxysql' }, () => {
  let containerName: string;

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
    await requirePmmClient(containerName, pmmAdminUpdateVersion);
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

  test.describe('more update flags', () => {
    test('PMM-T2810 - Verify pmm-admin update proxysql disables and enables a collector', async ({}) => {
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

    test('PMM-T2811 - Verify pmm-admin update proxysql sets and clears the cluster, replication set and custom labels', async ({}) => {
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

    test.describe('over TLS', () => {
      const admin = async (sql: string, flags = '') => cli.exec(`docker exec -e MYSQL_PWD=${PXC_PASSWORD} ${containerName} mysql -u${PXC_USER} -h127.0.0.1 -P6032 ${flags} -e "${sql}"`);
      const haveSsl = async (value: string) => (await admin(`UPDATE global_variables SET variable_value = '${value}' WHERE variable_name = 'mysql-have_ssl'; LOAD MYSQL VARIABLES TO RUNTIME`)).assertSuccess();
      let originalHaveSsl = '';

      // With mysql-have_ssl on, the admin interface the exporter reads offers TLS with ProxySQL's own certificate.
      test.beforeEach(async ({}) => {
        originalHaveSsl = (await admin("SELECT variable_value FROM global_variables WHERE variable_name = 'mysql-have_ssl'", '-NB')).stdout.trim();
        await haveSsl('true');
      });

      test.afterEach(async ({}) => {
        if (originalHaveSsl) await haveSsl(originalHaveSsl);
      });

      test('PMM-T2812 - Verify pmm-admin update proxysql turns TLS on and off over a TLS connection', async ({}) => {
        await (await admin('SELECT 1', '--ssl-mode=REQUIRED')).assertSuccess();
        const serviceId = await addService();
        const exporterId = (await pmmAdmin.findServiceAgentId(containerName, serviceId, 'AGENT_TYPE_PROXYSQL_EXPORTER'))!;
        const since = new Date();

        const setTls = async (flags: string, tls: boolean) => pmmAdmin.updateServiceUntilPersisted(containerName, 'proxysql', `${serviceName} ${flags}`, async () => {
          expect((await pmmApi.getServerAgent(exporterId)).tls, `TLS is not turned ${tls ? 'on' : 'off'} on PMM Server`).toBe(tls);
        });

        const on = await setTls('--tls --tls-skip-verify', true);
        expect(pmmAdmin.getChangedSettings(on).sort()).toEqual(['--tls (was --no-tls)', '--tls-skip-verify (was --no-tls-skip-verify)']);
        await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
        await pmmApi.expectSampleSince(`proxysql_up{service_name="${serviceName}"}`, since);

        const off = await setTls('--no-tls --no-tls-skip-verify', false);
        expect(pmmAdmin.getChangedSettings(off).sort()).toEqual(['--no-tls (was --tls)', '--no-tls-skip-verify (was --tls-skip-verify)']);
        await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
      });
    });

    test('PMM-T2813 - Verify pmm-admin update proxysql keeps the metrics reaching PMM Server in pull and push mode', async ({}) => {
      await addService();

      for (const mode of ['pull', 'push']) {
        const since = new Date();
        await pmmAdmin.updateServiceOk(containerName, 'proxysql', `${serviceName} --metrics-mode=${mode}`);
        await pmmApi.expectSampleSince(`proxysql_up{service_name="${serviceName}"}`, since);
      }
    });
  });
});
