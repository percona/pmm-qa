import pmmTest from '@fixtures/pmmTest';
import {
  currentQuerySource,
  QuerySource,
  qanAgentTypes,
  querySourceChanges,
  serviceQanSources,
} from '@helpers/serviceQan.helper';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

for (const serviceQan of serviceQanSources) {
  const { cleanup, name, serviceRegex, sources } = serviceQan;
  const offered: QuerySource[] = ['none', ...sources.map(({ value }) => value)];

  pmmTest.describe(`Edit service query source | ${name}`, () => {
    let service: GetService;
    let original: QuerySource;
    let container: string;

    pmmTest.beforeEach(async ({ api, cliHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      original = currentQuerySource(serviceQan, service);
      container = cliHelper.getContainerByAddress(await api.inventoryApi.getNodeAddress(service.node_id));
    });

    // A recreated QAN agent starts with the server's default QAN settings.
    pmmTest.afterEach(async ({ api, cliHelper, credentials }) => {
      if (cleanup) cliHelper.execSilent(cleanup(container, credentials)).assertSuccess();

      const current = currentQuerySource(
        serviceQan,
        await api.inventoryApi.getServiceById(service.service_id),
      );

      if (current !== original) {
        await api.inventoryApi.updateService(
          service.service_id,
          service.service_type,
          querySourceChanges(serviceQan, original),
        );
      }
    });

    pmmTest(
      `PMM-15674 - Verify Query Analytics section shows the current query source of ${name} service @inventory`,
      async ({ editServicePage }) => {
        await editServicePage.open(service.service_id);
        await expect(editServicePage.elements.qanSection).toBeVisible();
        await editServicePage.verifyQuerySource(original, offered);
      },
    );

    pmmTest(
      `PMM-15674 - Verify changing query source of ${name} service replaces its QAN agent @inventory`,
      async ({ api, clickHouseHelper, cliHelper, credentials, editServicePage, page }) => {
        // Ends on None, which removes the QAN agent, unless the service started without one.
        const targets = offered.filter((source) => source !== original && source !== 'none');

        if (original !== 'none') targets.push('none');

        for (const target of targets) {
          const source = sources.find(({ value }) => value === target);
          const expectedAgents = source ? [source.agentType] : [];

          await pmmTest.step(`Change query source to ${target}`, async () => {
            await editServicePage.open(service.service_id);
            await editServicePage.editQuerySource(target);

            const response = await editServicePage.saveChanges(service.service_id, false, true);

            expect(response.status(), await response.text()).toEqual(200);
            await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));

            await expect
              .poll(
                async () =>
                  qanAgentTypes(serviceQan, await api.inventoryApi.getServiceById(service.service_id)),
                {
                  message: `QAN agents of ${service.service_name} with query source ${target}`,
                  timeout: Timeouts.THIRTY_SECONDS,
                },
              )
              .toEqual(expectedAgents);

            await editServicePage.open(service.service_id);
            await editServicePage.verifyQuerySource(target, offered);
          });

          if (source?.workload) {
            const { agentType, workload } = source;

            await pmmTest.step(`QAN data from the ${target} agent reaches PMM Server`, async () => {
              const { agent_id } = await api.inventoryApi.getServiceExporter(service.service_id, agentType);

              await clickHouseHelper.waitForQanRowsByAgent('pmm-server', agent_id, () =>
                cliHelper.execSilent(workload(container, credentials)).assertSuccess(),
              );
            });
          } else if (source?.noData) {
            pmmTest.info().annotations.push({
              description: `QAN data from the ${target} agent is not checked: ${source.noData}`,
              type: 'note',
            });
          }
        }
      },
    );
  });
}

pmmTest(
  'PMM-15674 - Verify Query Analytics section is not shown for valkey service @inventory',
  async ({ api, editServicePage, grafanaHelper }) => {
    await grafanaHelper.authorize();

    const service = await api.inventoryApi.getServiceDetailsByRegex('^valkey-primary');

    await editServicePage.open(service.service_id);
    await expect(editServicePage.elements.qanSection).toBeHidden();
  },
);
