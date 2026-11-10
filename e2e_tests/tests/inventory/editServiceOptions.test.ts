import pmmTest from '@fixtures/pmmTest';
import { getServiceContainer } from '@helpers/frameworkServices.helper';
import {
  OptionValue,
  readOption,
  serviceOptionsSettings,
  toFormValue,
  toOptionChange,
} from '@helpers/serviceOptions.helper';
import {
  currentQuerySource,
  offeredQuerySources,
  QuerySource,
  querySourceChanges,
  serviceQanSources,
} from '@helpers/serviceQan.helper';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const MIB = 1_024 * 1_024;

for (const { exporterType, name, options, serviceRegex } of serviceOptionsSettings) {
  pmmTest.describe(`Edit service options | ${name}`, () => {
    let service: GetService;
    let container: string;

    pmmTest.beforeEach(async ({ api, dockerHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      container = await getServiceContainer(api, dockerHelper, service);
    });

    for (const option of options) {
      pmmTest.describe(option.label, () => {
        let original: OptionValue;

        pmmTest.beforeEach(async ({ api }) => {
          original = readOption(option, await api.inventoryApi.getServiceById(service.service_id));
        });

        pmmTest.afterEach(async ({ api }) => {
          await api.inventoryApi.updateService(
            service.service_id,
            service.service_type,
            toOptionChange(option, original),
          );
        });

        pmmTest(
          `PMM-15674 - Verify changing ${option.label} of ${name} service @inventory`,
          async ({ api, dockerHelper, editServicePage }) => {
            const edited = option.edit(original);

            await editServicePage.open(service.service_id);
            await editServicePage.verifyOption(option.field, toFormValue(original));
            await editServicePage.editOption(option.field, toFormValue(edited));

            const response = await editServicePage.saveChanges(service.service_id);

            await editServicePage.expectSaved(response);
            await expect
              .poll(
                async () => readOption(option, await api.inventoryApi.getServiceById(service.service_id)),
                {
                  message: `${option.label} stored for ${service.service_name}`,
                  timeout: Timeouts.THIRTY_SECONDS,
                },
              )
              .toEqual(edited);

            await expect
              .poll(
                async () =>
                  (await api.inventoryApi.getServiceExporter(service.service_id, exporterType)).status,
                { message: `${exporterType} runs after the change`, timeout: Timeouts.ONE_MINUTE },
              )
              .toEqual(AgentStatus.running);

            const exporter = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);
            const commandLine = option.commandLine?.(edited);

            if (commandLine) {
              await dockerHelper.waitForExporterCommandLine(container, exporter.listen_port, commandLine);
            }

            await editServicePage.open(service.service_id);
            await editServicePage.verifyOption(option.field, toFormValue(edited));
          },
        );
      });
    }
  });
}

const psQan = serviceQanSources.ps;

pmmTest.describe('Edit service slow log rotation | ps', () => {
  let service: GetService;
  let originalSource: QuerySource;

  pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
    await grafanaHelper.authorize();
    service = await api.inventoryApi.getServiceDetailsByRegex(psQan.serviceRegex);
    originalSource = currentQuerySource(psQan, service);
  });

  // Puts the original QAN agent back, which drops the slow log agent and its rotation size.
  pmmTest.afterEach(async ({ api }) => {
    const current = currentQuerySource(psQan, await api.inventoryApi.getServiceById(service.service_id));

    if (current !== originalSource) {
      await api.inventoryApi.updateService(
        service.service_id,
        service.service_type,
        querySourceChanges(psQan, originalSource),
      );
    }
  });

  pmmTest(
    'PMM-15674 - Verify changing slow log rotation size of ps service @inventory',
    async ({ api, editServicePage }) => {
      // The form takes MiB; the server stores bytes, and a disabled rotation (-1) as 0.
      for (const { mib, stored } of [
        { mib: '256', stored: 256 * MIB },
        { mib: '-1', stored: 0 },
      ]) {
        await pmmTest.step(`Change slow log rotation size to ${mib} MiB`, async () => {
          await editServicePage.open(service.service_id);
          await editServicePage.editQuerySource('slowlog');
          await editServicePage.inputs.maxSlowlogFileSize.fill(mib);

          const response = await editServicePage.saveChanges(service.service_id);

          await editServicePage.expectSaved(response);
          await expect
            .poll(
              async () => {
                const { agents } = await api.inventoryApi.getServiceById(service.service_id);
                const slowlog = agents.find(({ agent_type }) => agent_type === 'qan-mysql-slowlog-agent');

                return slowlog && Number(slowlog.max_query_log_size);
              },
              { message: 'slow log rotation size stored', timeout: Timeouts.THIRTY_SECONDS },
            )
            .toEqual(stored);

          await editServicePage.open(service.service_id);
          await editServicePage.verifyQuerySource('slowlog', offeredQuerySources(psQan));
          await expect(editServicePage.inputs.maxSlowlogFileSize).toHaveValue(mib);
        });
      }
    },
  );
});
