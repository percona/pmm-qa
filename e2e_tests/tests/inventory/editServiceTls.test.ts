import pmmTest from '@fixtures/pmmTest';
import {
  expectedTlsSecrets,
  serviceTlsSettings,
  storedTlsSecrets,
  tlsKeyPassword,
} from '@helpers/serviceTls.helper';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const tlsOff = { tls: false, tlsSkipVerify: false };

for (const settings of serviceTlsSettings) {
  const { apiCertificates, certificateFields, exporterType, name, serviceRegex } = settings;

  pmmTest.describe(`Edit service TLS | ${name}`, () => {
    let service: GetService;

    pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);

      const { tls } = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);

      // Stored certificates are never returned, so only a service without TLS can be put back as it was.
      expect(!!tls, `${service.service_name} must be monitored without TLS`).toBe(false);
    });

    pmmTest.afterEach(async ({ api }) => {
      await api.inventoryApi.updateService(service.service_id, service.service_type, {
        tls: false,
        tls_skip_verify: false,
        ...Object.fromEntries(apiCertificates.map((certificate) => [certificate, ''])),
      });
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
      `PMM-15674 - Verify enabling TLS with an untrusted CA is rejected by the connection check for ${name} service @inventory`,
      async ({ api, cliHelper, editServicePage, page }) => {
        const { cert } = cliHelper.generateSelfSignedCertificate('pmm-untrusted-ca');

        await editServicePage.open(service.service_id);
        await editServicePage.editTls({ tls: true, tlsSkipVerify: false }, { tlsCa: cert });

        const response = await editServicePage.saveChanges(service.service_id, false, true);

        expect(response.status(), 'connection check fails when the server cannot be verified').not.toEqual(
          200,
        );
        await expect(page).toHaveURL(new RegExp(`${service.service_id}/edit$`));

        const exporter = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);

        expect(!!exporter.tls, 'TLS stays off').toBe(false);
        expect(storedTlsSecrets(settings, exporter), 'no TLS secret is stored').toEqual(
          expectedTlsSecrets(settings, false),
        );
      },
    );

    pmmTest(
      `PMM-15674 - Verify enabling TLS with certificates and skipped verification of ${name} service @inventory`,
      async ({ api, cliHelper, editServicePage, page }) => {
        const { cert, key } = cliHelper.generateSelfSignedCertificate();
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

        // The service itself has no TLS, so the connection check would refuse the change.
        const response = await editServicePage.saveChanges(service.service_id, false, true, true);

        expect(response.status(), await response.text()).toEqual(200);
        await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));

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
  });
}
