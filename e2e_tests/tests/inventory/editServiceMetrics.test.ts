import pmmTest from '@fixtures/pmmTest';
import {
  exporterMetricsState,
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
import { AgentStatus, GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

for (const serviceMetrics of serviceMetricsSettings) {
  const { exporterType, name, serviceRegex, upMetric } = serviceMetrics;

  pmmTest.describe(`Edit service metrics | ${name}`, () => {
    let service: GetService;
    let original: ServiceMetricsSettings;
    let address: string;
    let container: string;

    pmmTest.beforeEach(async ({ api, cliHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      original = toMetricsSettings(
        await api.inventoryApi.getServiceExporter(service.service_id, exporterType),
      );
      address = await api.inventoryApi.getNodeAddress(service.node_id);
      container = cliHelper.getContainerByAddress(address);
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
      async ({ api, editServicePage, page }) => {
        const otherMode: MetricsMode =
          original.metricsMode === 'METRICS_MODE_PUSH' ? 'METRICS_MODE_PULL' : 'METRICS_MODE_PUSH';

        for (const metricsMode of [otherMode, original.metricsMode]) {
          await pmmTest.step(`Change metrics mode to ${metricsMode}`, async () => {
            const expected = { ...original, metricsMode };

            await editServicePage.open(service.service_id);
            await editServicePage.editMetrics({ metricsMode });

            const response = await editServicePage.saveChanges(service.service_id, false, true);

            expect(response.status(), await response.text()).toEqual(200);
            await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));
            await expect
              .poll(
                async () =>
                  exporterMetricsState(
                    await api.inventoryApi.getServiceExporter(service.service_id, exporterType),
                  ),
                { message: `${exporterType} in ${metricsMode}`, timeout: Timeouts.ONE_MINUTE },
              )
              .toEqual({ ...expected, status: AgentStatus.running });

            // Taken once the exporter runs in the new mode, so the sample cannot come from the old one:
            // PMM Server scrapes a pulled exporter, the client's vmagent sends a pushed one's metrics.
            const since = await api.prometheusApi.waitForServerTime();

            await api.prometheusApi.waitForSampleAfter(
              `${upMetric}{service_name="${service.service_name}"}`,
              since,
            );

            await editServicePage.open(service.service_id);
            await editServicePage.verifyMetrics(expected);
          });
        }
      },
    );

    pmmTest(
      `PMM-15674 - Verify exposing the ${name} exporter makes it reachable from PMM Server @inventory`,
      async ({ api, cliHelper, editServicePage, page }) => {
        // A pushing exporter listens only on its own host's 127.0.0.1 until it is exposed.
        const pushing: ServiceMetricsSettings = {
          ...original,
          exposeExporter: false,
          metricsMode: 'METRICS_MODE_PUSH',
        };
        const exposed = { ...pushing, exposeExporter: true };

        await api.inventoryApi.updateService(
          service.service_id,
          service.service_type,
          metricsSettingsChanges(pushing),
        );
        await expect
          .poll(
            async () => {
              const { listen_port } = await api.inventoryApi.getServiceExporter(
                service.service_id,
                exporterType,
              );

              return cliHelper.getHttpStatus('pmm-server', `http://${address}:${listen_port}/metrics`);
            },
            { message: 'an exporter that is not exposed cannot be reached', timeout: Timeouts.ONE_MINUTE },
          )
          .toEqual('000');

        await editServicePage.open(service.service_id);
        await editServicePage.verifyMetrics(pushing);
        await editServicePage.editMetrics({ exposeExporter: true });

        const response = await editServicePage.saveChanges(service.service_id, false, true);

        expect(response.status(), await response.text()).toEqual(200);
        await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));
        await expect
          .poll(
            async () =>
              exporterMetricsState(
                await api.inventoryApi.getServiceExporter(service.service_id, exporterType),
              ),
            { message: `${exporterType} exposed`, timeout: Timeouts.ONE_MINUTE },
          )
          .toEqual({ ...exposed, status: AgentStatus.running });

        // Any HTTP answer will do: the exporter asks for its agent password, or has none to ask for.
        await expect
          .poll(
            async () => {
              const { listen_port } = await api.inventoryApi.getServiceExporter(
                service.service_id,
                exporterType,
              );

              return cliHelper.getHttpStatus('pmm-server', `http://${address}:${listen_port}/metrics`);
            },
            { message: 'an exposed exporter can be reached from PMM Server', timeout: Timeouts.ONE_MINUTE },
          )
          .toMatch(/^(200|401)$/);

        await editServicePage.open(service.service_id);
        await editServicePage.verifyMetrics(exposed);
      },
    );

    pmmTest(
      `PMM-15674 - Verify changing log level of ${name} exporter @inventory`,
      async ({ api, cliHelper, editServicePage, page }) => {
        const verbose: LogLevel =
          original.logLevel === 'LOG_LEVEL_DEBUG' ? 'LOG_LEVEL_INFO' : 'LOG_LEVEL_DEBUG';

        await pmmTest.step(`Change log level to ${verbose}`, async () => {
          await editServicePage.open(service.service_id);
          await editServicePage.editMetrics({ logLevel: verbose });

          const response = await editServicePage.saveChanges(service.service_id, false, true);

          expect(response.status(), await response.text()).toEqual(200);
          await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));
          await expect
            .poll(
              async () =>
                exporterMetricsState(
                  await api.inventoryApi.getServiceExporter(service.service_id, exporterType),
                ),
              { message: `${exporterType} log level`, timeout: Timeouts.ONE_MINUTE },
            )
            .toEqual({ ...original, logLevel: verbose, status: AgentStatus.running });

          const { listen_port } = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);

          await expect
            .poll(
              () => cliHelper.getProcessCommandLine(container, 'listen-address=', `:${listen_port}`) ?? '',
              {
                message: `${exporterType} runs with the new log level`,
                timeout: Timeouts.ONE_MINUTE,
              },
            )
            .toMatch(logLevelFlag(verbose));

          await editServicePage.open(service.service_id);
          await editServicePage.verifyMetrics({ ...original, logLevel: verbose });
        });

        await pmmTest.step('Change log level back to Default', async () => {
          const expected = { ...original, logLevel: 'LOG_LEVEL_UNSPECIFIED' as const };

          await editServicePage.open(service.service_id);
          await editServicePage.editMetrics({ logLevel: 'LOG_LEVEL_UNSPECIFIED' });

          const response = await editServicePage.saveChanges(service.service_id, false, true);

          expect(response.status(), await response.text()).toEqual(200);
          await expect
            .poll(
              async () =>
                exporterMetricsState(
                  await api.inventoryApi.getServiceExporter(service.service_id, exporterType),
                ),
              { message: `${exporterType} log level`, timeout: Timeouts.ONE_MINUTE },
            )
            .toEqual({ ...expected, status: AgentStatus.running });

          await editServicePage.open(service.service_id);
          await editServicePage.verifyMetrics(expected);
        });
      },
    );

    pmmTest(
      `PMM-15674 - Verify changing connection timeout of ${name} exporter @inventory`,
      async ({ api, editServicePage, page }) => {
        const timeout = original.connectionTimeout === '7.5' ? '8.5' : '7.5';

        await pmmTest.step('A negative timeout is refused by the form', async () => {
          await editServicePage.open(service.service_id);
          await editServicePage.editMetrics({ connectionTimeout: '-1' });
          await editServicePage.buttons.saveChanges.click();
          await expect(editServicePage.elements.connectionTimeoutError).toBeVisible();
          await expect(editServicePage.elements.confirmModal).toBeHidden();
        });

        // Clearing the field puts the server's default timeout back.
        for (const connectionTimeout of [timeout, '']) {
          await pmmTest.step(`Change connection timeout to "${connectionTimeout}"`, async () => {
            const expected = { ...original, connectionTimeout };

            await editServicePage.open(service.service_id);
            await editServicePage.editMetrics({ connectionTimeout });

            const response = await editServicePage.saveChanges(service.service_id, false, true);

            expect(response.status(), await response.text()).toEqual(200);
            await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));
            await expect
              .poll(
                async () =>
                  exporterMetricsState(
                    await api.inventoryApi.getServiceExporter(service.service_id, exporterType),
                  ),
                { message: `${exporterType} connection timeout`, timeout: Timeouts.ONE_MINUTE },
              )
              .toEqual({ ...expected, status: AgentStatus.running });

            await editServicePage.open(service.service_id);
            await editServicePage.verifyMetrics(expected);
          });
        }
      },
    );
  });
}
