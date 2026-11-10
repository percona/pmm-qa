import pmmTest from '@fixtures/pmmTest';
import { ServiceAgent, TlsServerName, tlsServers } from '@helpers/serviceTls.helper';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, GetService } from '@interfaces/inventory';
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

    pmmTest.beforeEach(async ({ api, cliHelper, credentials, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      container = cliHelper.getContainerByAddress(await api.inventoryApi.getNodeAddress(service.node_id));

      if (serverTlsCheck) {
        expect(
          cliHelper.execSilent(serverTlsCheck(container, credentials)).code,
          `${container} must serve TLS`,
        ).toEqual(0);
      }
      if (instance) {
        cliHelper.removeService(container, instance.serviceType, instance.serviceName);
        cliHelper.execSilent(instance.stop(container));
        cliHelper.execSilent(instance.start(container)).assertSuccess();
        cliHelper.execSilent(instance.register(container)).assertSuccess();
        service = await api.inventoryApi.getServiceDetailsByRegex(`^${instance.serviceName}$`);
      }

      exporter = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);
      originalTls = original?.(cliHelper, container, exporter);
    });

    pmmTest.afterEach(async ({ api, cliHelper }) => {
      if (originalTls) {
        await api.inventoryApi.updateService(service.service_id, service.service_type, originalTls);
      }
      if (instance) {
        cliHelper.removeService(container, instance.serviceType, instance.serviceName);
        cliHelper.execSilent(instance.stop(container)).assertSuccess();
      }
    });

    pmmTest(
      `PMM-15674 - Verify TLS verification refuses a server certificate from an untrusted CA for ${name} service ${tag}`,
      async ({ api, cliHelper, editServicePage, page }) => {
        const { cert } = cliHelper.generateSelfSignedCertificate('pmm-untrusted-ca');

        await editServicePage.open(service.service_id);
        await editServicePage.editTls({ tls: true, tlsSkipVerify: false }, { tlsCa: cert });

        const response = await editServicePage.saveChanges(service.service_id, false, true);

        expect(
          response.status(),
          'connection check fails when the server certificate cannot be verified',
        ).not.toEqual(200);
        await expect(page).toHaveURL(new RegExp(`${service.service_id}/edit$`));

        const { status, tls, tls_skip_verify } = await api.inventoryApi.getServiceExporter(
          service.service_id,
          exporterType,
        );

        expect(
          { status, tls: !!tls, tls_skip_verify: !!tls_skip_verify },
          'stored TLS settings are unchanged',
        ).toEqual({
          status: AgentStatus.running,
          tls: !!exporter.tls,
          tls_skip_verify: !!exporter.tls_skip_verify,
        });
      },
    );

    pmmTest(
      `PMM-15674 - Verify skipping TLS verification accepts a server certificate from an untrusted CA for ${name} service ${tag}`,
      async ({ api, cliHelper, editServicePage, page }) => {
        const { cert } = cliHelper.generateSelfSignedCertificate('pmm-untrusted-ca');

        await editServicePage.open(service.service_id);
        await editServicePage.editTls({ tls: true, tlsSkipVerify: true }, { tlsCa: cert });

        const response = await editServicePage.saveChanges(service.service_id, false, true);

        expect(response.status(), await response.text()).toEqual(200);
        await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));

        await expect
          .poll(
            async () => {
              const { status, tls, tls_skip_verify } = await api.inventoryApi.getServiceExporter(
                service.service_id,
                exporterType,
              );

              return { status, tls: !!tls, tls_skip_verify: !!tls_skip_verify };
            },
            {
              message: `${exporterType} connects over TLS without verification`,
              timeout: Timeouts.ONE_MINUTE,
            },
          )
          .toEqual({ status: AgentStatus.running, tls: true, tls_skip_verify: true });
      },
    );
  });
}
