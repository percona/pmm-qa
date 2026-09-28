import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';
import MongoDashboards from '@pages/dashboards/mongo';
import MysqlDashboards from '@pages/dashboards/mysql';
import OperatingSystemDashboards from '@pages/dashboards/operating-system';
import PostgresqlDashboards from '@pages/dashboards/postgresql';

const nodeAnnotationName = 'mysql-node-name';
const processesDetailsUrl = OperatingSystemDashboards.processesDetails.url;
const annotations = [
  {
    annotationName: 'annotation-for-postgres-server',
    dashboard: PostgresqlDashboards.postgresqlInstanceSummary.url,
    service: 'pmm-server',
    service_type: ServiceType.postgresql,
  },
  {
    annotationName: 'annotation-for-mongo',
    dashboard: MongoDashboards.instanceSummary.url,
    service: 'rs101',
    service_type: ServiceType.mongodb,
  },
  {
    annotationName: 'annotation-for-postgres',
    dashboard: PostgresqlDashboards.postgresqlInstanceSummary.url,
    service: 'pgsql',
    service_type: ServiceType.postgresql,
  },
  {
    annotationName: 'annotation-for-mysql',
    dashboard: MysqlDashboards.mysqlInstanceSummary.url,
    service: 'ps_',
    service_type: ServiceType.mysql,
  },
  {
    annotationName: nodeAnnotationName,
    dashboard: OperatingSystemDashboards.nodesCompare.url,
    service: 'ps_',
    service_type: ServiceType.mysql,
  },
];

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

for (const annotation of annotations) {
  pmmTest(
    `PMM-T878 - Verify adding annotation specific dashboard @nightly  @dashboards @annotations | ${JSON.stringify(annotation)}`,
    async ({ api, dashboard, page, urlHelper }) => {
      const { nodeName, serviceName } = await pmmTest.step(
        `Add annotation ${annotation.annotationName} for ${annotation.service}`,
        async () => {
          const service =
            annotation.service === 'pmm-server'
              ? await api.inventoryApi.getServiceDetailsByPartialName(annotation.service)
              : await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
                  annotation.service_type,
                  annotation.service,
                );
          const node = service.node_name;
          const response = await api.annotationApi.setAnnotation(
            annotation.annotationName,
            'PMM-T878',
            node,
            service.service_name,
          );

          expect(
            response.status(),
            `Failed to add annotation ${annotation.annotationName} for ${service.service_name}`,
          ).toEqual(200);

          return { nodeName: node, serviceName: service.service_name };
        },
      );

      await pmmTest.step(`Verify ${annotation.annotationName} is loaded on the dashboard`, async () => {
        const isNodeAnnotation = annotation.annotationName === nodeAnnotationName;
        const filteredDashboardUrl = urlHelper.buildUrlWithParameters(
          annotation.dashboard,
          isNodeAnnotation
            ? { from: 'now-1h', nodeName, refresh: '5s', to: 'now' }
            : { from: 'now-1h', refresh: '5s', serviceName, to: 'now' },
        );

        await page.goto(filteredDashboardUrl);
        await dashboard.waitForDashboardToLoad();
        await dashboard.hoverAnnotationMarker(annotation.annotationName);
      });
    },
  );
}

pmmTest(
  'PMM-T878 - Verify user is not able to add an annotation for non-existing node name or service name and without service name @nightly  @dashboards @annotations',
  async ({ api }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mysql,
      'ps_',
    );
    const wrongNodeName = await api.annotationApi.setAnnotation(
      'wrong-node-name',
      'PMM-T878',
      'random1',
      service_name,
    );

    expect(wrongNodeName.status(), 'Annotation with a non-existing node name must be rejected').toEqual(404);

    const wrongServiceName = await api.annotationApi.setAnnotation(
      'wrong-service-name',
      'PMM-T878',
      'pmm-server',
      'random2',
    );

    expect(wrongServiceName.status(), 'Annotation with a non-existing service name must be rejected').toEqual(
      404,
    );

    const emptyServiceName = await api.annotationApi.setAnnotation(
      'empty-service-name',
      'PMM-T878',
      'pmm-server',
      '',
    );

    expect(emptyServiceName.status(), 'Annotation without a service name must be rejected').toEqual(400);
  },
);

pmmTest(
  'PMM-T165 - Verify Annotation with Default Options @fb-instances',
  async ({ cliHelper, dashboard, page, urlHelper }) => {
    const annotationTitle = 'pmm-annotate-without-tags';

    cliHelper.execute(`docker exec haproxy_pmm pmm-admin annotate "${annotationTitle}"`).assertSuccess();

    await page.goto(urlHelper.buildUrlWithParameters(processesDetailsUrl, { from: 'now-45m', to: 'now' }));
    await dashboard.waitForDashboardToLoad();
    await dashboard.hoverAnnotationMarker(annotationTitle);
  },
);

pmmTest(
  'PMM-T166 - Verify adding annotation with specified tags @fb-instances',
  async ({ cliHelper, dashboard, page, urlHelper }) => {
    const annotationTitle = 'pmm-annotate-tags';
    const annotationTag1 = 'pmm-testing-tag1';
    const annotationTag2 = 'pmm-testing-tag2';
    const defaultAnnotationTag = 'pmm_annotation';

    cliHelper
      .execute(
        `docker exec haproxy_pmm pmm-admin annotate "${annotationTitle}" --tags="${annotationTag1},${annotationTag2}"`,
      )
      .assertSuccess();

    await page.goto(urlHelper.buildUrlWithParameters(processesDetailsUrl, { from: 'now-45m', to: 'now' }));
    await dashboard.waitForDashboardToLoad();
    await dashboard.hoverAnnotationMarker(annotationTitle);
    await expect(dashboard.builders.annotationTagText(annotationTag1)).toBeVisible();
    await expect(dashboard.builders.annotationTagText(annotationTag2)).toBeVisible();
    await expect(dashboard.builders.annotationTagText(defaultAnnotationTag)).toBeVisible();
  },
);
