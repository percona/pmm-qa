import pmmTest from '@fixtures/pmmTest';
import { frameworkServices } from '@helpers/frameworkServices.helper';
import {
  basicAuth,
  endpointExporterType,
  EndpointSettings,
  readEndpoint,
  serviceEndpoints,
} from '@helpers/serviceEndpoint.helper';
import { Timeouts } from '@helpers/timeouts';
import { GetService, ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const unreachablePort = '59999';
const missingPath = '/pmm-missing-metrics';

for (const ownService of serviceEndpoints) {
  const { serviceType: name } = ownService;
  const hasGroup = name === ServiceType.external;

  pmmTest.describe(`Edit service metrics endpoint | ${name}`, () => {
    let service: GetService;
    let original: EndpointSettings;
    let container: string;
    let up: string;

    pmmTest.beforeEach(async ({ api, cliHelper, dockerHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();

      container = await dockerHelper.getServiceContainer(
        api,
        await api.inventoryApi.getServiceDetailsByRegex(frameworkServices.haproxy.serviceRegex),
      );
      cliHelper.removeService(container, ownService.serviceType, ownService.serviceName);
      cliHelper.execSilent(ownService.register(container)).assertSuccess();
      service = await api.inventoryApi.getServiceDetailsByRegex(`^${ownService.serviceName}$`);
      // The service is added again under the same name for every test, and the series of the one removed
      // before it can still be in the query window, so only the service ID tells them apart.
      up = `up{service_id="${service.service_id}"}`;

      const { passwordSet, ...settings } = await readEndpoint(api, service.service_id);

      expect(passwordSet, `${service.service_name} starts without a basic auth password`).toBe(false);
      original = settings;
    });

    pmmTest.afterEach(async ({ cliHelper }) => {
      cliHelper.removeService(container, ownService.serviceType, ownService.serviceName);
    });

    pmmTest(
      `PMM-15674 - Verify Metrics endpoint section shows the current settings of ${name} service @inventory`,
      async ({ editServicePage }) => {
        await editServicePage.open(service.service_id);
        await expect(editServicePage.elements.connectionSection).toContainText('Metrics endpoint');
        await editServicePage.verifyEndpoint(original);
        await expect(editServicePage.inputs.agentPassword).toBeHidden();
        await expect(editServicePage.inputs.database).toBeHidden();
        await expect(editServicePage.inputs.tls).toBeHidden();
        await expect(editServicePage.elements.qanSection).toBeHidden();
      },
    );

    pmmTest(
      `PMM-15674 - Verify basic auth and skipped TLS verification of ${name} endpoint keep its metrics coming @inventory`,
      async ({ api, editServicePage }) => {
        const expected = { ...original, tlsSkipVerify: true, username: basicAuth.username };

        await editServicePage.open(service.service_id);
        await editServicePage.editEndpoint({ ...basicAuth, tlsSkipVerify: true });

        // The endpoint takes no auth, so the connection check passes with the credentials too.
        const response = await editServicePage.saveChanges(service.service_id);

        await editServicePage.expectSaved(response);
        await expect
          .poll(() => readEndpoint(api, service.service_id), {
            message: `${endpointExporterType} endpoint stored`,
            timeout: Timeouts.THIRTY_SECONDS,
          })
          .toEqual({ ...expected, passwordSet: true });
        await api.prometheusApi.waitForNewValue(up, 1);

        await editServicePage.open(service.service_id);
        await editServicePage.verifyEndpoint(expected);
        await expect(editServicePage.elements.passwordKeptHint).toBeVisible();
      },
    );

    pmmTest(
      `PMM-15674 - Verify changing listen port of ${name} endpoint @inventory`,
      async ({ api, editServicePage }) => {
        await pmmTest.step('An unreachable port is refused by the connection check', async () => {
          await editServicePage.open(service.service_id);
          await editServicePage.editEndpoint({ listenPort: unreachablePort });

          const response = await editServicePage.saveChanges(service.service_id);

          await editServicePage.expectRefused(
            response,
            service.service_id,
            'the connection check refuses a port nothing listens on',
          );
          expect((await readEndpoint(api, service.service_id)).listenPort).toEqual(original.listenPort);
        });

        await pmmTest.step('Saved without the check, the unreachable port stops the scrape', async () => {
          await editServicePage.open(service.service_id);
          await editServicePage.editEndpoint({ listenPort: unreachablePort });

          const response = await editServicePage.saveChanges(service.service_id, {
            skipConnectionCheck: true,
          });

          await editServicePage.expectSaved(response);
          await expect
            .poll(async () => (await readEndpoint(api, service.service_id)).listenPort, {
              message: 'listen port stored',
              timeout: Timeouts.THIRTY_SECONDS,
            })
            .toEqual(unreachablePort);
          await api.prometheusApi.waitForNewValue(up, 0);
        });

        await pmmTest.step('Back on the original port, the metrics come again', async () => {
          await editServicePage.open(service.service_id);
          await editServicePage.editEndpoint({ listenPort: original.listenPort });

          const response = await editServicePage.saveChanges(service.service_id);

          await editServicePage.expectSaved(response);
          await expect
            .poll(async () => (await readEndpoint(api, service.service_id)).listenPort, {
              message: 'listen port stored',
              timeout: Timeouts.THIRTY_SECONDS,
            })
            .toEqual(original.listenPort);
          await api.prometheusApi.waitForNewValue(up, 1);

          await editServicePage.open(service.service_id);
          await editServicePage.verifyEndpoint(original);
        });
      },
    );

    // Path and scheme are saved with the connection check skipped, so the test does not depend on whether
    // the server checks them; what it shows is that the scrape follows the new endpoint and so fails.
    for (const { change, label, stored } of [
      // The form adds the leading slash, as pmm-admin does.
      {
        change: { metricsPath: missingPath.slice(1) },
        label: 'metrics path',
        stored: { metricsPath: missingPath },
      },
      { change: { scheme: 'https' as const }, label: 'scheme', stored: { scheme: 'https' as const } },
    ]) {
      pmmTest(
        `PMM-15674 - Verify changing ${label} of ${name} endpoint @inventory`,
        async ({ api, editServicePage }) => {
          const expected = { ...original, ...stored };

          await editServicePage.open(service.service_id);
          await editServicePage.editEndpoint(change);

          const response = await editServicePage.saveChanges(service.service_id, {
            skipConnectionCheck: true,
          });

          await editServicePage.expectSaved(response);
          await expect
            .poll(() => readEndpoint(api, service.service_id), {
              message: `${label} stored`,
              timeout: Timeouts.THIRTY_SECONDS,
            })
            .toEqual({ ...expected, passwordSet: false });
          await api.prometheusApi.waitForNewValue(up, 0);

          await editServicePage.open(service.service_id);
          await editServicePage.verifyEndpoint(expected);
        },
      );
    }

    if (hasGroup) {
      pmmTest(
        `PMM-15674 - Verify changing group of ${name} service relabels its metrics @inventory`,
        async ({ api, editServicePage }) => {
          const expected = { ...original, group: 'pmm_edit_group' };

          await editServicePage.open(service.service_id);
          await editServicePage.editEndpoint({ group: expected.group });

          // The group is a label, so the agents do not restart and no connection check runs.
          const response = await editServicePage.saveChanges(service.service_id, { settingsChanged: false });

          await editServicePage.expectSaved(response);
          await expect
            .poll(() => readEndpoint(api, service.service_id), {
              message: 'group stored',
              timeout: Timeouts.THIRTY_SECONDS,
            })
            .toEqual({ ...expected, passwordSet: false });
          await api.prometheusApi.waitForNewValue(
            `up{service_id="${service.service_id}",external_group="${expected.group}"}`,
            1,
          );

          await editServicePage.open(service.service_id);
          await editServicePage.verifyEndpoint(expected);
        },
      );
    }
  });
}
