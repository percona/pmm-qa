import pmmTest from '@fixtures/pmmTest';
import { startOwnService, stopOwnService } from '@helpers/frameworkServices.helper';
import { exporterTlsState, TlsServerName, tlsServers } from '@helpers/serviceTls.helper';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, GetService, ServiceAgent } from '@interfaces/inventory';
import { expect } from '@playwright/test';

// CI picks the test files to run by searching their text for the job's tag, so every tag has to be written here.
const tags: Record<TlsServerName, string> = {
  ps: '@inventory',
  psmdb: '@inventory',
  ssl_mysql: '@ssl-mysql',
  ssl_pdpgsql: '@ssl-postgres',
  valkey: '@inventory',
};

// Each server presents a certificate this CA did not sign, so only skipping verification lets the exporter connect.
for (const { exporterType, instance, name, original, serverTlsCheck, serviceRegex } of tlsServers) {
  const tag = tags[name];

  pmmTest.describe(`Edit service TLS verification | ${name}`, () => {
    let service: GetService;
    let container: string;
    let exporter: ServiceAgent;
    let originalTls: Record<string, unknown> | undefined;

    pmmTest.beforeEach(async ({ api, cliHelper, credentials, dockerHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      container = await dockerHelper.getServiceContainer(api, service);

      if (serverTlsCheck) {
        expect(
          cliHelper.execSilent(serverTlsCheck(container, credentials)).code,
          `${container} must serve TLS`,
        ).toEqual(0);
      }
      if (instance) {
        startOwnService(cliHelper, container, instance);
        service = await api.inventoryApi.getServiceDetailsByRegex(`^${instance.serviceName}$`);
      }

      exporter = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);
      originalTls = original?.(cliHelper, container, exporter);
    });

    pmmTest.afterEach(async ({ api, cliHelper }) => {
      if (originalTls) {
        await api.inventoryApi.updateService(service.service_id, service.service_type, originalTls);
      }
      if (instance) stopOwnService(cliHelper, container, instance);
    });

    pmmTest(
      `PMM-T2736 - Verify TLS verification refuses a server certificate from an untrusted CA for ${name} service ${tag}`,
      async ({ api, editServicePage, tlsHelper }) => {
        const { cert } = tlsHelper.generateSelfSignedCertificate('pmm-untrusted-ca');

        await editServicePage.open(service.service_id);
        await editServicePage.editTls({ tls: true, tlsSkipVerify: false }, { tlsCa: cert });

        const response = await editServicePage.saveChanges(service.service_id);

        await editServicePage.verifyRefused(
          response,
          service.service_id,
          'connection check fails when the server certificate cannot be verified',
        );

        expect(
          exporterTlsState(await api.inventoryApi.getServiceExporter(service.service_id, exporterType)),
          'stored TLS settings are unchanged',
        ).toEqual({ ...exporterTlsState(exporter), status: AgentStatus.running });
      },
    );

    pmmTest(
      `PMM-T2737 - Verify skipping TLS verification accepts a server certificate from an untrusted CA for ${name} service ${tag}`,
      async ({ api, editServicePage, tlsHelper }) => {
        // eslint-disable-next-line playwright/no-skipped-test -- skip-until: 2026-12-03 -- PMM-15940: PostgreSQL still verifies the server certificate against a stored CA when skip verification is on; unskip once it is fixed.
        pmmTest.skip(
          name === 'ssl_pdpgsql',
          'PMM-15940: PostgreSQL ignores skipped TLS verification when a CA is set',
        );

        const { cert } = tlsHelper.generateSelfSignedCertificate('pmm-untrusted-ca');

        await editServicePage.open(service.service_id);
        await editServicePage.editTls({ tls: true, tlsSkipVerify: true }, { tlsCa: cert });

        const response = await editServicePage.saveChanges(service.service_id);

        await editServicePage.verifySaved(response);
        await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();

        await expect
          .poll(
            async () =>
              exporterTlsState(await api.inventoryApi.getServiceExporter(service.service_id, exporterType)),
            {
              message: `${exporterType} connects over TLS without verification`,
              timeout: Timeouts.ONE_MINUTE,
            },
          )
          .toEqual({ status: AgentStatus.running, tls: true, tlsSkipVerify: true });
      },
    );
  });
}
