import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const databases = [
  { name: 'pdpgsql', serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$' },
  { name: 'ps', serviceRegex: '^ps_pmm' },
  { name: 'psmdb', serviceRegex: '^rs101_' },
  { name: 'valkey', serviceRegex: '^valkey-primary' },
];

for (const { name, serviceRegex } of databases) {
  pmmTest.describe(`Edit service labels | ${name}`, () => {
    let service: GetService;

    pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
    });

    pmmTest.afterEach(async ({ api }) => {
      await api.inventoryApi.changeServiceLabels(service.service_id, {
        environment: service.environment ?? '',
        replication_set: service.replication_set ?? '',
      });
    });

    pmmTest(
      `PMM-15674 - Verify changing environment and replication set of ${name} service in Inventory @inventory`,
      async ({ api, editServicePage, page }) => {
        const labels = { environment: `${name}-edited-env`, replicationSet: `${name}-edited-rs` };

        await editServicePage.open(service.service_id);
        await editServicePage.verifyLabels({
          environment: service.environment ?? '',
          replicationSet: service.replication_set ?? '',
        });

        const response = await editServicePage.saveLabels(service.service_id, labels);

        expect(response.status(), await response.text()).toEqual(200);
        await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));

        await expect
          .poll(
            async () =>
              (await api.inventoryApi.getServices()).services.find(
                ({ service_id }) => service_id === service.service_id,
              ),
            { message: `${service.service_name} labels after edit`, timeout: Timeouts.THIRTY_SECONDS },
          )
          .toMatchObject({
            cluster: service.cluster,
            environment: labels.environment,
            replication_set: labels.replicationSet,
          });

        await editServicePage.open(service.service_id);
        await editServicePage.verifyLabels(labels);
      },
    );
  });
}
