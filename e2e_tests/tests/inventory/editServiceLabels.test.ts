import pmmTest from '@fixtures/pmmTest';
import { databaseServices } from '@helpers/frameworkServices.helper';
import {
  registerEndpointService,
  removeEndpointService,
  serviceEndpoints,
} from '@helpers/serviceMetrics.helper';
import { GetService } from '@interfaces/inventory';
import { ServiceLabels } from '@pages/inventory/editService.page';

const labelEdits: ServiceLabels = {
  cluster: 'editCluster',
  customLabels: { edited_label_a: 'editCustomLabelA', edited_label_b: 'editCustomLabelB' },
  environment: 'editEnvironment',
  replicationSet: 'editReplicationSet',
};

for (const { name, serviceRegex } of databaseServices) {
  pmmTest.describe(`Edit service labels | ${name}`, () => {
    let service: GetService;

    pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
    });

    pmmTest.afterEach(async ({ api, editServicePage }) => {
      const { cluster, customLabels, environment, replicationSet } = editServicePage.toLabels(service);

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
        await editServicePage.verifyLabelsChange(service, labelEdits, () =>
          api.inventoryApi.getServiceById(service.service_id),
        );
      },
    );
  });
}

for (const ownService of serviceEndpoints) {
  const { name } = ownService;

  pmmTest.describe(`Edit service labels | ${name}`, () => {
    let service: GetService;
    let container: string;

    pmmTest.beforeEach(async ({ api, cliHelper, dockerHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();
      ({ container, service } = await registerEndpointService(api, cliHelper, dockerHelper, ownService));
    });

    pmmTest.afterEach(async ({ api, cliHelper }) => {
      await removeEndpointService(api, cliHelper, container, ownService);
    });

    pmmTest(
      `PMM-15674 - Verify changing labels of ${name} service in Inventory @inventory`,
      async ({ api, editServicePage }) => {
        await editServicePage.verifyLabelsChange(service, labelEdits, () =>
          api.inventoryApi.getServiceById(service.service_id),
        );
      },
    );
  });
}
