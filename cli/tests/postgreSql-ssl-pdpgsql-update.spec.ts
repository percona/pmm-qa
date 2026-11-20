import { test, expect, skipWithoutUpdateCommand } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';

const certsDir = '/certificates';
const tlsFiles = `--tls-ca-file=${certsDir}/ca.crt --tls-cert-file=${certsDir}/client.crt --tls-key-file=${certsDir}/client.pem`;

test.describe('TLS Percona Distribution for PostgreSQL pmm-admin update', { tag: '@ssl-pdpgsql' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'pgsql_ssl_update_cli';
  const untrusted = 'pgsql_ssl_untrusted';
  let serviceAdded = false;

  const addService = async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add postgresql --username=pmm --password=pmm --query-source=none --tls ${tlsFiles} ${serviceName} 127.0.0.1:5432`);
    await output.assertSuccess();
    serviceAdded = true;
    const serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    const exporterId = (await pmmAdmin.findServiceAgentId(containerName, serviceId, 'AGENT_TYPE_POSTGRES_EXPORTER'))!;
    expect(exporterId, 'postgres_exporter not found').toBeTruthy();
    await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);

    return exporterId;
  };

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep \'^pdpgsql_pgsm_ssl_\'');
    await result.outContains('pdpgsql_pgsm_ssl_', 'TLS PDPGSQL docker container should exist. please run pmm-framework with --database ssl_pdpgsql');
    containerName = result.stdout.trim();
    await skipWithoutUpdateCommand(containerName);
  });

  test.afterEach(async ({}) => {
    await pmmCli.runEach([
      async () => {
        if (serviceAdded) await pmmAdmin.removePGService(containerName, serviceName);
        serviceAdded = false;
      },
      async () => {
        await (await cli.exec(`docker exec ${containerName} rm -rf /tmp/${untrusted}`)).assertSuccess();
      },
    ]);
  });

  test('PMM-TXXXX-ssl-pg-certificates - Verify pmm-admin update postgresql applies the CA, client certificate and key over a TLS connection', async ({}) => {
    const exporterId = await addService();
    const since = new Date();

    const output = await pmmAdmin.updateServiceOk(containerName, 'postgresql', `${serviceName} ${tlsFiles}`);
    expect(pmmAdmin.getChangedSettings(output).sort()).toEqual(['--tls-ca-file (new value)', '--tls-cert-file (new value)', '--tls-key-file (new value)']);
    expect(pmmAdmin.getCurrentSettings(output)).toContain('--tls-key-file=***');

    expect((await pmmApi.getServerAgent(exporterId)).tls, 'TLS is turned off on PMM Server').toBe(true);
    await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
    await pmmApi.expectSampleSince(`pg_up{service_name="${serviceName}"}`, since);
  });

  test('PMM-TXXXX-ssl-pg-skip-verify - Verify pmm-admin update postgresql turns certificate verification off and on over a TLS connection', async ({}) => {
    const exporterId = await addService();

    const skipped = await pmmAdmin.updateServiceOk(containerName, 'postgresql', `${serviceName} --tls-skip-verify`);
    expect(pmmAdmin.getChangedSettings(skipped)).toEqual(['--tls-skip-verify (was --no-tls-skip-verify)']);
    expect((await pmmApi.getServerAgent(exporterId)).tls_skip_verify, 'Certificate verification is not skipped on PMM Server').toBe(true);
    await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);

    const since = new Date();
    const verified = await pmmAdmin.updateServiceOk(containerName, 'postgresql', `${serviceName} --no-tls-skip-verify`);
    expect(pmmAdmin.getChangedSettings(verified)).toEqual(['--no-tls-skip-verify (was --tls-skip-verify)']);
    expect((await pmmApi.getServerAgent(exporterId)).tls_skip_verify, 'Certificate verification is not enabled on PMM Server').toBe(false);
    await pmmApi.expectSampleSince(`pg_up{service_name="${serviceName}"}`, since);
  });

  test('PMM-TXXXX-ssl-pg-skip-verify-untrusted-ca - Verify pmm-admin update postgresql with --tls-skip-verify accepts a CA that did not sign the server certificate', async ({}) => {
    test.skip(true, 'Skipping this test, bug https://perconadev.atlassian.net/browse/PMM-15940');

    const exporterId = await addService();
    const certificate = await pmmCli.createSelfSignedCertificate(containerName, untrusted);

    const output = await pmmAdmin.updateServiceOk(containerName, 'postgresql', `${serviceName} --tls-skip-verify --tls-ca-file=${certificate.cert}`);
    expect(pmmAdmin.getChangedSettings(output).sort()).toEqual(['--tls-ca-file (new value)', '--tls-skip-verify (was --no-tls-skip-verify)']);
    await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
  });

  test('PMM-TXXXX-ssl-pg-untrusted-ca - Verify pmm-admin update postgresql refuses a server certificate the CA did not sign and changes nothing', async ({}) => {
    const exporterId = await addService();
    const before = await pmmApi.getServerAgent(exporterId);
    const certificate = await pmmCli.createSelfSignedCertificate(containerName, untrusted);

    const output = await pmmAdmin.updateService(containerName, 'postgresql', `${serviceName} --tls-ca-file=${certificate.cert}`);
    await cli.expectFailure(output, 'Connection check failed');

    const after = await pmmApi.getServerAgent(exporterId);
    expect(after.tls_skip_verify, 'Verification is changed by a refused update').toEqual(before.tls_skip_verify);
    await pmmAdmin.expectAgentsRunning(containerName, [exporterId], true);
  });
});
