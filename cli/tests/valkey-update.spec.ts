import { expect, requirePmmClient, test } from '@helpers/test';
import { pmmAdminUpdateVersion } from '@helpers/versionGates';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const containerName = 'valkey-primary-1';
const port = '6379';
const username = 'default';
const password = 'VKvl41568AsE';

test.describe('Valkey pmm-admin update', { tag: '@valkey' }, () => {
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
    await requirePmmClient(containerName, pmmAdminUpdateVersion);
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

  test.describe('more update flags', () => {
    test('PMM-T2777 - Verify pmm-admin update valkey sets and clears the labels', async ({}) => {
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

    test.describe('over TLS', () => {
      const tlsServiceName = 'valkey_update_tls_cli';
      const tlsDir = '/tmp/valkey_update_tls';
      const tlsPort = 6390;
      const untrusted = 'valkey_update_untrusted';
      let tlsServiceAdded = false;

      // A TLS-only valkey-server of the test's own, next to the framework's, with a certificate that names 127.0.0.1.
      test.beforeEach(async ({}) => {
        await (await cli.exec(`docker exec ${containerName} sh -c 'rm -rf ${tlsDir} && mkdir -p ${tlsDir} && openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=pmm-tls-server -addext subjectAltName=IP:127.0.0.1 -keyout ${tlsDir}/server.key -out ${tlsDir}/server.crt 2>/dev/null && valkey-server --port 0 --tls-port ${tlsPort} --bind 127.0.0.1 --tls-cert-file ${tlsDir}/server.crt --tls-key-file ${tlsDir}/server.key --tls-ca-cert-file ${tlsDir}/server.crt --tls-auth-clients no --dir ${tlsDir} --save "" --pidfile ${tlsDir}/valkey.pid --logfile ${tlsDir}/valkey.log --daemonize yes && timeout 30 sh -c "until valkey-cli --tls --insecure -p ${tlsPort} ping >/dev/null 2>&1; do sleep 0.2; done"'`)).assertSuccess();
      });

      test.afterEach(async ({}) => {
        await pmmCli.runEach([
          async () => {
            if (tlsServiceAdded) await pmmAdmin.removeService(containerName, 'valkey', tlsServiceName);
            tlsServiceAdded = false;
          },
          async () => {
            await (await cli.exec(`docker exec ${containerName} sh -c 'pid=$(cat ${tlsDir}/valkey.pid 2>/dev/null) && kill $pid && while kill -0 $pid 2>/dev/null; do sleep 0.2; done; rm -rf ${tlsDir} /tmp/${untrusted}'`)).assertSuccess();
          },
        ]);
      });

      const addTlsService = async () => {
        const output = await cli.exec(`docker exec ${containerName} pmm-admin add valkey --service-name=${tlsServiceName} --host=127.0.0.1 --port=${tlsPort} --tls --tls-skip-verify`);
        await output.assertSuccess();
        tlsServiceAdded = true;
        const serviceId = await pmmAdmin.getServiceId(containerName, tlsServiceName);
        const exporterId = (await pmmAdmin.findServiceAgentId(containerName, serviceId, 'AGENT_TYPE_VALKEY_EXPORTER'))!;
        expect(exporterId, 'valkey_exporter not found').toBeTruthy();

        return { serviceId, exporterId };
      };

      test('PMM-T2778 - Verify pmm-admin update valkey verifies the server certificate against a CA and a client certificate', async ({}) => {
        const { exporterId } = await addTlsService();
        const since = new Date();

        const output = await pmmAdmin.updateServiceOk(
          containerName,
          'valkey',
          `${tlsServiceName} --no-tls-skip-verify --tls-ca=${tlsDir}/server.crt --tls-cert=${tlsDir}/server.crt --tls-key=${tlsDir}/server.key`,
        );
        expect(pmmAdmin.getChangedSettings(output).sort()).toEqual([
          '--no-tls-skip-verify (was --tls-skip-verify)',
          '--tls-ca (new value)',
          '--tls-cert (new value)',
          '--tls-key (new value)',
        ]);

        const agent = await pmmApi.getServerAgent(exporterId);
        expect(agent.tls, 'TLS is turned off on PMM Server').toBe(true);
        expect(agent.tls_skip_verify, 'Certificate verification is not enabled on PMM Server').toBe(false);
        await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
        await pmmApi.expectSampleSince(`redis_up{service_name="${tlsServiceName}"}`, since);
      });

      test('PMM-T2779 - Verify pmm-admin update valkey refuses a server certificate the CA did not sign and changes nothing', async ({}) => {
        const { exporterId } = await addTlsService();
        const tlsBefore = await pmmApi.getServerAgent(exporterId);
        const certificate = await pmmCli.createSelfSignedCertificate(containerName, untrusted);

        const output = await pmmAdmin.updateService(containerName, 'valkey', `${tlsServiceName} --no-tls-skip-verify --tls-ca=${certificate.cert}`);
        await cli.expectFailure(output, 'Connection check failed');

        const tlsAfter = await pmmApi.getServerAgent(exporterId);
        expect(tlsAfter.tls_skip_verify, 'Verification is enabled by a refused update').toEqual(tlsBefore.tls_skip_verify);
        await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
      });
    });

    test('PMM-T2780 - Verify pmm-admin update valkey keeps the metrics reaching PMM Server in pull and push mode', async ({}) => {
      await addService();

      for (const mode of ['pull', 'push']) {
        const since = new Date();
        await pmmAdmin.updateServiceOk(containerName, 'valkey', `${serviceName} --metrics-mode=${mode}`);
        await pmmApi.expectSampleSince(`redis_up{service_name="${serviceName}"}`, since);
      }
    });
  });
});
