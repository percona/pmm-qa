import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import { databaseServices, frameworkServices } from '@helpers/frameworkServices.helper';
import { serviceEndpoints } from '@helpers/serviceMetrics.helper';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import EditServicePage, { ServiceLabels } from '@pages/inventory/editService.page';
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

const changeLabels = async (api: Api, editServicePage: EditServicePage, service: GetService) => {
  await editServicePage.open(service.service_id);
  await editServicePage.verifyLabels(toLabels(service));

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
};

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
        await changeLabels(api, editServicePage, service);
      },
    );
  });
}

// A service of the test's own is removed afterwards, so nothing has to be put back through the update API.
for (const ownService of serviceEndpoints) {
  const { serviceType: name } = ownService;

  pmmTest.describe(`Edit service labels | ${name}`, () => {
    let service: GetService;
    let container: string;

    pmmTest.beforeEach(async ({ api, cliHelper, dockerHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();
      container = await dockerHelper.getServiceContainer(
        api,
        await api.inventoryApi.getServiceDetailsByRegex(frameworkServices.haproxy.serviceRegex),
      );
      cliHelper.removeService(container, ownService.serviceType, ownService.serviceName);
      cliHelper.execSilent(ownService.register(container)).assertSuccess();
      service = await api.inventoryApi.getServiceDetailsByRegex(`^${ownService.serviceName}$`);
    });

    pmmTest.afterEach(async ({ cliHelper }) => {
      cliHelper.removeService(container, ownService.serviceType, ownService.serviceName);
    });

    pmmTest(
      `PMM-15674 - Verify changing labels of ${name} service in Inventory @inventory`,
      async ({ api, editServicePage }) => {
        await changeLabels(api, editServicePage, service);
      },
    );
  });
}
