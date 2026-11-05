import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import { ServiceLabels } from '@pages/inventory/editService.page';
import { expect } from '@playwright/test';

const databases = [
  { name: 'pdpgsql', serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$' },
  { name: 'ps', serviceRegex: '^ps_pmm' },
  { name: 'psmdb', serviceRegex: '^rs101_' },
  { name: 'valkey', serviceRegex: '^valkey-primary' },
];
const labelEdits = [
  { edit: 'editEnvironment', label: 'environment' },
  { edit: 'editReplicationSet', label: 'replicationSet' },
  { edit: 'editCluster', label: 'cluster' },
] as const;
const toLabels = ({ cluster, environment, replication_set }: GetService): ServiceLabels => ({
  cluster: cluster ?? '',
  environment: environment ?? '',
  replicationSet: replication_set ?? '',
});

for (const { name, serviceRegex } of databases) {
  pmmTest.describe(`Edit service labels | ${name}`, () => {
    let service: GetService;

    pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
    });

    pmmTest.afterEach(async ({ api }) => {
      const { cluster, environment, replicationSet } = toLabels(service);

      await api.inventoryApi.changeServiceLabels(service.service_id, {
        cluster,
        environment,
        replication_set: replicationSet,
      });
    });

    for (const { label } of labelEdits) {
      pmmTest(
        `PMM-15674 - Verify changing ${label} of ${name} service in Inventory @inventory`,
        async ({ api, editServicePage, page }) => {
          const original = toLabels(service);
          const expected = { ...original, [label]: `${name}-edited-${label}` };

          await editServicePage.open(service.service_id);
          await editServicePage.verifyLabels(original);

          const clusterResponse = await editServicePage.editCluster(service.service_id, expected.cluster);

          expect(clusterResponse.status(), await clusterResponse.text()).toEqual(200);

          const environmentResponse = await editServicePage.editEnvironment(
            service.service_id,
            expected.environment,
          );

          expect(environmentResponse.status(), await environmentResponse.text()).toEqual(200);

          const replicationSetResponse = await editServicePage.editReplicationSet(
            service.service_id,
            expected.replicationSet,
          );

          expect(replicationSetResponse.status(), await replicationSetResponse.text()).toEqual(200);

          await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();
          await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));

          await expect
            .poll(
              async () => {
                const edited = (await api.inventoryApi.getServices()).services.find(
                  ({ service_id }) => service_id === service.service_id,
                );

                return edited && toLabels(edited);
              },
              { message: `${service.service_name} labels after edit`, timeout: Timeouts.THIRTY_SECONDS },
            )
            .toEqual(expected);

          await editServicePage.open(service.service_id);
          await editServicePage.verifyLabels(expected);
        },
      );
    }
  });
}
