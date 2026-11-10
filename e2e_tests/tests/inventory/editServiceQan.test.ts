import pmmTest from '@fixtures/pmmTest';
import {
  addOwnService,
  frameworkServices,
  getServiceContainer,
  removeOwnService,
} from '@helpers/frameworkServices.helper';
import {
  currentQuerySource,
  offeredQuerySources,
  QuerySource,
  qanAgentTypes,
  qanInstances,
  querySourceChanges,
  serviceQanSources,
} from '@helpers/serviceQan.helper';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';
import { serverContainer } from '@testdata/datasourceProxy';

for (const serviceQan of Object.values(serviceQanSources)) {
  const { cleanup, name, restoreState, saveState, serviceRegex, sources } = serviceQan;
  const offered = offeredQuerySources(serviceQan);

  pmmTest.describe(`Edit service query source | ${name}`, () => {
    let service: GetService;
    let original: QuerySource;
    let container: string;
    let savedState: string | undefined;

    pmmTest.beforeEach(async ({ api, cliHelper, credentials, dockerHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      original = currentQuerySource(serviceQan, service);
      container = await getServiceContainer(api, dockerHelper, service);
      savedState =
        saveState &&
        cliHelper.execSilent(saveState(container, credentials)).assertSuccess().getStdOutLines().at(-1);
    });

    // A recreated QAN agent starts with the server's default QAN settings.
    pmmTest.afterEach(async ({ api, cliHelper, credentials }) => {
      if (cleanup) cliHelper.execSilent(cleanup(container, credentials)).assertSuccess();
      if (restoreState && savedState) {
        cliHelper.execSilent(restoreState(container, credentials, savedState)).assertSuccess();
      }

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
      async ({ api, clickHouseHelper, cliHelper, credentials, editServicePage }) => {
        // Ends on None, which removes the QAN agent, unless the service started without one.
        const targets = offered.filter((source) => source !== original && source !== 'none');

        if (original !== 'none') targets.push('none');

        for (const target of targets) {
          const source = sources.find(({ value }) => value === target);
          const expectedAgents = source ? [source.agentType] : [];

          await pmmTest.step(`Change query source to ${target}`, async () => {
            await editServicePage.open(service.service_id);
            await editServicePage.editQuerySource(target);

            const response = await editServicePage.saveChanges(service.service_id);

            await editServicePage.expectSaved(response);

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

              await clickHouseHelper.waitForQanRowsByAgent(serverContainer, agent_id, () =>
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

for (const { name, serviceRegex } of [frameworkServices.valkey, frameworkServices.proxysql]) {
  pmmTest(
    `PMM-15674 - Verify Query Analytics section is not shown for ${name} service @inventory`,
    async ({ api, editServicePage, grafanaHelper }) => {
      await grafanaHelper.authorize();

      const service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);

      await editServicePage.open(service.service_id);
      await expect(editServicePage.elements.qanSection).toBeHidden();
    },
  );
}

const pdpgsqlQan = serviceQanSources.pdpgsql;

pmmTest(
  "PMM-15674 - Verify query source of PMM Server's own PostgreSQL cannot be changed in the form @inventory",
  async ({ api, editServicePage, grafanaHelper }) => {
    await grafanaHelper.authorize();

    const service = await api.inventoryApi.getServiceDetailsByRegex('^pmm-server-postgresql$');
    const offered = offeredQuerySources(pdpgsqlQan);

    await editServicePage.open(service.service_id);
    await editServicePage.verifyQuerySource(currentQuerySource(pdpgsqlQan, service), offered);

    for (const querySource of offered) {
      await expect(editServicePage.builders.querySourceOption(querySource)).toBeDisabled();
    }

    await expect(editServicePage.elements.querySourceRestriction).toHaveText(
      'Query Analytics for PMM’s internal PostgreSQL is turned on and off in Settings.',
    );
  },
);

for (const instance of qanInstances) {
  const { agentType, hostServiceRegex, name, querySource, serviceName } = instance;

  pmmTest.describe(`Edit service query source on a database of its own | ${name}`, () => {
    let container: string;
    let service: GetService;

    pmmTest.beforeEach(async ({ api, cliHelper, dockerHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();

      container = await getServiceContainer(
        api,
        dockerHelper,
        await api.inventoryApi.getServiceDetailsByRegex(hostServiceRegex),
      );
      service = await addOwnService(api, cliHelper, container, instance);
    });

    pmmTest.afterEach(async ({ cliHelper }) => {
      removeOwnService(cliHelper, container, instance);
    });

    pmmTest(
      `PMM-15674 - Verify QAN data reaches PMM Server after switching ${name} to ${querySource} @inventory`,
      async ({ api, clickHouseHelper, cliHelper, editServicePage }) => {
        await editServicePage.open(service.service_id);
        await expect(editServicePage.builders.querySourceOption('none')).toBeChecked();
        await editServicePage.editQuerySource(querySource);

        const response = await editServicePage.saveChanges(service.service_id);

        await editServicePage.expectSaved(response);
        await expect
          .poll(
            async () =>
              (await api.inventoryApi.getServiceById(service.service_id)).agents.some(
                ({ agent_type }) => agent_type === agentType,
              ),
            { message: `${serviceName} has a ${agentType}`, timeout: Timeouts.THIRTY_SECONDS },
          )
          .toBe(true);

        const { agent_id } = await api.inventoryApi.getServiceExporter(service.service_id, agentType);

        await clickHouseHelper.waitForQanRowsByAgent(serverContainer, agent_id, () =>
          cliHelper.execSilent(instance.workload(container)).assertSuccess(),
        );
      },
    );
  });
}
