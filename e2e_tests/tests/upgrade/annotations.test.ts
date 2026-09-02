import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM upgrade tests for annotations', () => {
  const tag = 'Upgrade-PMM-T878';
  const services = [
    { annotationName: 'annotation-for-mysql', name: 'ps_pmm', serviceType: 'mysql' },
    { annotationName: 'annotation-for-postgres', name: 'pgsql_pgs', serviceType: 'postgresql' },
    { annotationName: 'annotation-for-mongo', name: 'rs101', serviceType: 'mongodb' },
  ];

  for (const service of services) {
    pmmTest(
      `Adding annotation before upgrade at service Level for ${service.serviceType} @pre-upgrade`,
      async ({ api }) => {
        const details = (await api.inventoryApi.getAllServicesDetailsByPartialName(service.name)).find(
          (found) => !found.service_name.includes('ssl'),
        );

        if (!details) {
          throw new Error(`Service with name ${service.name} was not found!`);
        }

        expect(details, `Service including "${service.name}" (non-ssl) not found`).toBeTruthy();

        await api.annotationsApi.setAnnotation({
          nodeName: details.node_name,
          serviceNames: [details.service_name],
          tags: [tag],
          text: service.annotationName,
        });
      },
    );
  }

  for (const service of services) {
    pmmTest(
      `Verify added Annotations at service level, also available post upgrade for ${service.serviceType} @post-upgrade`,
      async ({ api }) => {
        const annotations = await api.annotationsApi.getAnnotationsByTag(tag);

        console.log(`Available annotations are: \n ${JSON.stringify(annotations)}`);

        expect(
          annotations.some((annotation) => annotation.text.includes(service.annotationName)),
          `Annotation "${service.annotationName}" was not found post upgrade`,
        ).toBeTruthy();
      },
    );
  }
});
