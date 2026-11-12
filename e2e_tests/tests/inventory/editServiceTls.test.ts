import pmmTest from '@fixtures/pmmTest';
import {
  expectedTlsSecrets,
  serviceTlsSettings,
  storedTlsSecrets,
  tlsKeyPassword,
  tlsOffChanges,
} from '@helpers/serviceTls.helper';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const tlsOff = { tls: false, tlsSkipVerify: false };

for (const settings of serviceTlsSettings) {
  const { certificateFields, exporterType, name, serverTls, serviceRegex } = settings;

  pmmTest.describe(`Edit service TLS | ${name}`, () => {
    let service: GetService;
    let tlsServerContainer: string | undefined;

    pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);

      const { tls } = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);

      // Stored certificates are never returned, so only a service without TLS can be put back as it was.
      expect(!!tls, `${service.service_name} must be monitored without TLS`).toBe(false);
    });

    pmmTest.afterEach(async ({ api, cliHelper, credentials }) => {
      // Before TLS goes off, so the connection check finds the database taking connections without it again.
      if (serverTls && tlsServerContainer) {
        const container = tlsServerContainer;

        tlsServerContainer = undefined;
        cliHelper.execSilent(serverTls.disable(container)).assertSuccess();
        await expect
          .poll(() => cliHelper.execSilent(serverTls.plainProbe(container, credentials)).code, {
            message: `${container} takes connections without TLS again`,
            timeout: Timeouts.TWO_MINUTES,
          })
          .toEqual(0);
      }

      await api.inventoryApi.updateService(
        service.service_id,
        service.service_type,
        tlsOffChanges(certificateFields),
      );
    });

    pmmTest(
      `PMM-15674 - Verify TLS section shows the current settings and the ${name} certificate fields @inventory`,
      async ({ editServicePage }) => {
        await editServicePage.open(service.service_id);
        await editServicePage.verifyTls(tlsOff, certificateFields);

        await editServicePage.editTls({ tls: true, tlsSkipVerify: false });
        await editServicePage.verifyTls({ tls: true, tlsSkipVerify: false }, certificateFields);
        await expect(editServicePage.buttons.saveChanges).toBeEnabled();

        await editServicePage.editTls(tlsOff);
        await editServicePage.verifyTls(tlsOff, certificateFields);
        await expect(editServicePage.buttons.saveChanges).toBeDisabled();
      },
    );

    pmmTest(
      `PMM-15674 - Verify enabling TLS is rejected by the connection check when the ${name} server cannot be verified @inventory`,
      async ({ api, editServicePage, tlsHelper }) => {
        const { cert } = tlsHelper.generateSelfSignedCertificate('pmm-untrusted-ca');

        await editServicePage.open(service.service_id);
        // Without a CA field the system roots are used, so a server without TLS or with its own certificate fails either way.
        await editServicePage.editTls(
          { tls: true, tlsSkipVerify: false },
          certificateFields.includes('tlsCa') ? { tlsCa: cert } : {},
        );

        const response = await editServicePage.saveChanges(service.service_id);

        await editServicePage.expectRefused(
          response,
          service.service_id,
          'connection check fails when the server cannot be verified',
        );

        const exporter = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);

        expect(!!exporter.tls, 'TLS stays off').toBe(false);
        expect(storedTlsSecrets(settings, exporter), 'no TLS secret is stored').toEqual(
          expectedTlsSecrets(settings, false),
        );
      },
    );

    pmmTest(
      `PMM-15674 - Verify enabling TLS with skipped verification and the ${name} certificates @inventory`,
      async ({ api, editServicePage, tlsHelper }) => {
        const { cert, key } = tlsHelper.generateSelfSignedCertificate();
        const certificates = {
          tlsCa: cert,
          tlsCert: cert,
          tlsCertificateKey: `${cert}\n${key}`,
          tlsCertificateKeyFilePassword: tlsKeyPassword,
          tlsKey: key,
        };
        const tlsOn = { tls: true, tlsSkipVerify: true };

        await editServicePage.open(service.service_id);
        await editServicePage.editTls(
          tlsOn,
          Object.fromEntries(certificateFields.map((field) => [field, certificates[field]])),
        );

        // The service is monitored without TLS, so the connection check could refuse the change.
        const response = await editServicePage.saveChanges(service.service_id, { skipConnectionCheck: true });

        await editServicePage.expectSaved(response);
        await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();

        await expect
          .poll(
            async () => {
              const exporter = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);

              return {
                secrets: storedTlsSecrets(settings, exporter),
                tls: !!exporter.tls,
                tlsSkipVerify: !!exporter.tls_skip_verify,
              };
            },
            { message: `${exporterType} TLS settings after edit`, timeout: Timeouts.THIRTY_SECONDS },
          )
          .toEqual({
            secrets: expectedTlsSecrets(settings, true),
            tls: true,
            tlsSkipVerify: true,
          });

        await editServicePage.open(service.service_id);
        await editServicePage.verifyTls(tlsOn, certificateFields);
      },
    );

    if (serverTls) {
      pmmTest(
        `PMM-15674 - Verify ${name} exporter works over TLS once enabled, with and without verification @inventory`,
        async ({ api, cliHelper, credentials, dockerHelper, editServicePage }) => {
          const container = await dockerHelper.getServiceContainer(api, service);
          const exporter = () => api.inventoryApi.getServiceExporter(service.service_id, exporterType);
          const up = `${serverTls.upMetric}{service_name="${service.service_name}"}`;

          await pmmTest.step(`${container} takes TLS connections only`, async () => {
            tlsServerContainer = container;
            cliHelper.execSilent(serverTls.enable(container)).assertSuccess();
            // systemd returns from the restart before the database has read its TLS settings.
            await expect
              .poll(() => cliHelper.execSilent(serverTls.tlsProbe(container, credentials)).code, {
                message: `${container} takes TLS connections`,
                timeout: Timeouts.TWO_MINUTES,
              })
              .toEqual(0);
            expect(
              cliHelper.execSilent(serverTls.plainProbe(container, credentials)).code,
              `${container} refuses connections without TLS`,
            ).not.toEqual(0);
          });

          await pmmTest.step('Enable TLS without verification', async () => {
            await editServicePage.open(service.service_id);
            await editServicePage.saveTls(
              service.service_id,
              { tls: true, tlsSkipVerify: true },
              serverTls.certificates(cliHelper, container),
              certificateFields,
              exporter,
            );
            await api.prometheusApi.waitForNewValue(up, 1);
          });

          // The server certificate names the container the exporter connects to, so it passes verification too.
          await pmmTest.step('Verify the server certificate against the CA', async () => {
            await editServicePage.saveTls(
              service.service_id,
              { tls: true, tlsSkipVerify: false },
              {},
              certificateFields,
              exporter,
            );
            await api.prometheusApi.waitForNewValue(up, 1);
          });
        },
      );
    }
  });
}
