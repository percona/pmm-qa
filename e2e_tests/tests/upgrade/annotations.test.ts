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
    // eslint-disable-next-line playwright/expect-expect -- Temporary
    pmmTest(
      `Adding annotation before upgrade at service Level for ${service.serviceType} @pre-upgrade`,
      async ({ api }) => {
        const details = (await api.inventoryApi.getAllServicesDetailsByPartialName(service.name)).find(
          (found) => !found.service_name.includes('ssl'),
        );

        if (!details) {
          throw new Error(`Service with name ${service.name} was not found!`);
        }

        await api.annotationApi.setAnnotation(
          service.annotationName,
          tag,
          details.node_name,
          details.service_name,
        );
      },
    );
  }

  for (const service of services) {
    pmmTest(
      `Verify added Annotations at service level, also available post upgrade for ${service.serviceType} @post-upgrade`,
      async ({ api }) => {
        const annotations = await api.annotationApi.getAnnotationsByTag(tag);

        expect(
          annotations.some((annotation) => annotation.text.includes(service.annotationName)),
          `Annotation "${service.annotationName}" was not found post upgrade`,
        ).toBeTruthy();
      },
    );
  }
});
