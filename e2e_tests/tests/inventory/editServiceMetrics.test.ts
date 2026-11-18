import pmmTest from '@fixtures/pmmTest';
import {
  exporterHttpStatus,
  LogLevel,
  logLevelFlag,
  MetricsMode,
  metricsSettingsChanges,
  offeredLogLevels,
  ServiceMetricsSettings,
  serviceMetricsSettings,
  toMetricsSettings,
} from '@helpers/serviceMetrics.helper';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

for (const serviceMetrics of serviceMetricsSettings) {
  const { exporterType, name, serviceRegex, upMetric } = serviceMetrics;

  pmmTest.describe(`Edit service metrics | ${name}`, () => {
    let service: GetService;
    let original: ServiceMetricsSettings;
    let container: string;

    pmmTest.beforeEach(async ({ api, dockerHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      original = toMetricsSettings(
        await api.inventoryApi.getServiceExporter(service.service_id, exporterType),
      );
      container = await dockerHelper.getServiceContainer(api, service);
    });

    pmmTest.afterEach(async ({ api }) => {
      await api.inventoryApi.updateService(
        service.service_id,
        service.service_type,
        metricsSettingsChanges(original),
      );
    });

    pmmTest(
      `PMM-15674 - Verify Metrics section shows the current settings of ${name} service @inventory`,
      async ({ editServicePage }) => {
        await editServicePage.open(service.service_id);
        await expect(editServicePage.elements.metricsSection).toBeVisible();
        await editServicePage.verifyMetrics(original);
        await editServicePage.verifyLogLevelOptions(offeredLogLevels(serviceMetrics));
      },
    );

    pmmTest(
      `PMM-15674 - Verify changing metrics mode of ${name} service keeps its metrics reaching PMM Server @inventory`,
      async ({ api, editServicePage }) => {
        const otherMode: MetricsMode =
          original.metricsMode === 'METRICS_MODE_PUSH' ? 'METRICS_MODE_PULL' : 'METRICS_MODE_PUSH';
        const { agent_id } = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);
        const serverTargets = async () =>
          (await api.grafanaApi.getActiveTargets())
            .filter(({ labels }) => labels.instance === agent_id)
            .map(({ health, lastError, scrapeUrl }) => ({ health, lastError, scrapeUrl }));

        await editServicePage.open(service.service_id);

        for (const metricsMode of [otherMode, original.metricsMode]) {
          await pmmTest.step(`Change metrics mode to ${metricsMode}`, async () => {
            await editServicePage.verifyMetricsChange(service.service_id, original, { metricsMode }, () =>
              api.inventoryApi.getServiceExporter(service.service_id, exporterType),
            );

            // PMM Server scrapes a pulled exporter, the client's vmagent sends a pushed one's metrics. A new
            // sample alone does not say which: vmagent can still scrape the exporter just after it turns to pull.
            await expect
              .poll(serverTargets, {
                message: `PMM Server scrapes the exporter only in pull mode, now ${metricsMode}`,
                timeout: Timeouts.TWO_MINUTES,
              })
              .toEqual(
                metricsMode === 'METRICS_MODE_PULL'
                  ? expect.arrayContaining([expect.objectContaining({ health: 'up' })])
                  : [],
              );
            await api.prometheusApi.waitForNewSample(`${upMetric}{service_name="${service.service_name}"}`);
          });
        }
      },
    );

    pmmTest(
      `PMM-15674 - Verify exposing the ${name} exporter makes it reachable from PMM Server @inventory`,
      async ({ api, dockerHelper, editServicePage }) => {
        // A pushing exporter listens only on its own host's 127.0.0.1 until it is exposed.
        const pushing: ServiceMetricsSettings = {
          ...original,
          exposeExporter: false,
          metricsMode: 'METRICS_MODE_PUSH',
        };

        await api.inventoryApi.updateService(
          service.service_id,
          service.service_type,
          metricsSettingsChanges(pushing),
        );
        await expect
          .poll(() => exporterHttpStatus(api, dockerHelper, container, service, exporterType), {
            message: 'an exporter that is not exposed cannot be reached',
            timeout: Timeouts.ONE_MINUTE,
          })
          .toEqual('000');

        await editServicePage.open(service.service_id);
        await editServicePage.verifyMetrics(pushing);
        await editServicePage.verifyMetricsChange(service.service_id, pushing, { exposeExporter: true }, () =>
          api.inventoryApi.getServiceExporter(service.service_id, exporterType),
        );

        // Any HTTP answer will do: the exporter asks for its agent password, or has none to ask for.
        await expect
          .poll(() => exporterHttpStatus(api, dockerHelper, container, service, exporterType), {
            message: 'an exposed exporter can be reached from PMM Server',
            timeout: Timeouts.ONE_MINUTE,
          })
          .toMatch(/^(200|401)$/);
      },
    );

    pmmTest(
      `PMM-15674 - Verify changing log level of ${name} exporter @inventory`,
      async ({ api, dockerHelper, editServicePage }) => {
        const verbose: LogLevel =
          original.logLevel === 'LOG_LEVEL_DEBUG' ? 'LOG_LEVEL_INFO' : 'LOG_LEVEL_DEBUG';

        await editServicePage.open(service.service_id);

        await pmmTest.step(`Change log level to ${verbose}`, async () => {
          await editServicePage.verifyMetricsChange(service.service_id, original, { logLevel: verbose }, () =>
            api.inventoryApi.getServiceExporter(service.service_id, exporterType),
          );
          await dockerHelper.verifyExporterCommandLine(
            container,
            (await api.inventoryApi.getServiceExporter(service.service_id, exporterType)).listen_port,
            {
              matches: true,
              pattern: logLevelFlag(verbose),
            },
          );
        });

        await pmmTest.step('Change log level back to Default', async () => {
          await editServicePage.verifyMetricsChange(
            service.service_id,
            original,
            { logLevel: 'LOG_LEVEL_UNSPECIFIED' },
            () => api.inventoryApi.getServiceExporter(service.service_id, exporterType),
          );
        });
      },
    );

    pmmTest(
      `PMM-15674 - Verify changing connection timeout of ${name} exporter @inventory`,
      async ({ api, editServicePage }) => {
        const timeout = original.connectionTimeout === '7.5' ? '8.5' : '7.5';

        await pmmTest.step('A negative timeout is refused by the form', async () => {
          await editServicePage.open(service.service_id);
          await editServicePage.editMetrics({ connectionTimeout: '-1' });
          await editServicePage.buttons.saveChanges.click();
          await expect(editServicePage.elements.connectionTimeoutError).toBeVisible();
          await expect(editServicePage.elements.confirmModal).toBeHidden();
        });

        await editServicePage.open(service.service_id);

        // Clearing the field puts the server's default timeout back.
        for (const connectionTimeout of [timeout, '']) {
          await pmmTest.step(`Change connection timeout to "${connectionTimeout}"`, async () => {
            await editServicePage.verifyMetricsChange(
              service.service_id,
              original,
              { connectionTimeout },
              () => api.inventoryApi.getServiceExporter(service.service_id, exporterType),
            );
          });
        }
      },
    );
  });
}
