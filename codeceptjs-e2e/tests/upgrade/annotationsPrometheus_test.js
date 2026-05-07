const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

Feature('PMM upgrade tests for annotations');

const { dashboardPage } = inject();

const clientDbServices = new DataTable(['serviceType', 'name', 'metric', 'annotationName', 'dashboard', 'upgrade_service']);

clientDbServices.add([SERVICE_TYPE.MYSQL, 'ps_pmm', 'mysql_global_status_max_used_connections', 'annotation-for-mysql', dashboardPage.mysqlInstanceSummaryDashboard.url, 'mysql_upgrade']);
clientDbServices.add([SERVICE_TYPE.POSTGRESQL, 'pgsql_pgs', 'pg_stat_database_xact_rollback', 'annotation-for-postgres', dashboardPage.postgresqlInstanceSummaryDashboard.url, 'pgsql_upgrade']);
clientDbServices.add([SERVICE_TYPE.MONGODB, 'rs101', 'mongodb_connections', 'annotation-for-mongo', dashboardPage.mongoDbInstanceSummaryDashboard.url, 'mongo_upgrade']);

Before(async ({ I }) => {
  await I.Authorize();
});

Data(clientDbServices).Scenario(
  'Adding annotation before upgrade At service Level @pre-annotations-prometheus-upgrade',
  async ({
    annotationAPI, inventoryAPI, current,
  }) => {
    const {
      serviceType, name, annotationName,
    } = current;

    const apiServiceDetails = await inventoryAPI.getServiceDetailsByPartialName(name);
    const { node_id, service_name } = await inventoryAPI.apiGetNodeInfoByServiceName(serviceType, apiServiceDetails.service_name, 'ssl');
    const nodeName = await inventoryAPI.getNodeName(node_id);

    await annotationAPI.setAnnotation(annotationName, 'Upgrade-PMM-T878', nodeName, service_name, 200);
  },
);

Data(clientDbServices).Scenario(
  'Verify added Annotations at service level, also available post upgrade @post-client-upgrade @post-annotations-prometheus-upgrade',
  async ({
    I, dashboardPage, current, inventoryAPI,
  }) => {
    const {
      serviceType, name, annotationName, dashboard,
    } = current;
    const { service_name } = await inventoryAPI.apiGetNodeInfoByServiceName(serviceType, name, 'ssl');
    const dashboardUrl = I.buildUrlWithParams(dashboard.split('?')[0], {
      service_name,
      from: 'now-60m',
    });

    I.amOnPage(dashboardUrl);
    dashboardPage.waitForDashboardOpened();
    dashboardPage.verifyAnnotationsLoaded(annotationName);
    I.seeElement(dashboardPage.annotationText(annotationName), 10);
  },
);
