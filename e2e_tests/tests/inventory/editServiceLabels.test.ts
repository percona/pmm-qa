import pmmTest from '@fixtures/pmmTest';
import { databaseServices } from '@helpers/frameworkServices.helper';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import { ServiceLabels } from '@pages/inventory/editService.page';
import { expect } from '@playwright/test';

const labelEdits: ServiceLabels = {
  cluster: 'editCluster',
  customLabels: { edited_label_a: 'editCustomLabelA', edited_label_b: 'editCustomLabelB' },
  environment: 'editEnvironment',
  replicationSet: 'editReplicationSet',
};
const toLabels = ({ cluster, custom_labels, environment, replication_set }: GetService): ServiceLabels => ({
  cluster: cluster ?? '',
  customLabels: custom_labels ?? {},
  environment: environment ?? '',
  replicationSet: replication_set ?? '',
});

for (const { name, serviceRegex } of databaseServices) {
  pmmTest.describe(`Edit service labels | ${name}`, () => {
    let service: GetService;

    pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
    });

    pmmTest.afterEach(async ({ api }) => {
      const { cluster, customLabels, environment, replicationSet } = toLabels(service);

      await api.inventoryApi.updateService(service.service_id, service.service_type, {
        cluster,
        custom_labels: { values: customLabels },
        environment,
        replication_set: replicationSet,
      });
    });

    pmmTest(
      `PMM-15674 - Verify changing labels of ${name} service in Inventory @inventory`,
      async ({ api, editServicePage }) => {
        const original = toLabels(service);

        await editServicePage.open(service.service_id);
        await editServicePage.verifyLabels(original);

        await editServicePage.editCluster(labelEdits.cluster);
        await editServicePage.editEnvironment(labelEdits.environment);
        await editServicePage.editReplicationSet(labelEdits.replicationSet);
        await editServicePage.editCustomLabels(labelEdits.customLabels);

        const response = await editServicePage.saveChanges(service.service_id, {
          clusterChanged: true,
          settingsChanged: false,
        });

        await editServicePage.expectSaved(response);
        await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();

        await expect
          .poll(async () => toLabels(await api.inventoryApi.getServiceById(service.service_id)), {
            message: `${service.service_name} labels after edit`,
            timeout: Timeouts.THIRTY_SECONDS,
          })
          .toEqual(labelEdits);

        await editServicePage.open(service.service_id);
        await editServicePage.verifyLabels(labelEdits);
      },
    );
  });
}
