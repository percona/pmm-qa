import pmmTest from '@fixtures/pmmTest';
import data from '@fixtures/dataTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

const services = ['ps_pmm|mysql_pmm', 'pxc_node'];

pmmTest(
  'PMM-T2103 Open the HAProxy Instance Summary Dashboard and verify Metrics are present and graphs are displayed @pmm-ps-pxc-haproxy-integration',
  async ({ api, dashboard, page, urlHelper }) => {
    await api.grafanaApi.waitForMetric('haproxy_process_start_time_seconds', Timeouts.TWO_MINUTES);
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.haproxyInstanceSummary.url, {
        from: 'now-1h',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.haproxyInstanceSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.haproxyInstanceSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.haproxyInstanceSummary.metricsWithData);
  },
);

data(services).pmmTest(
  'PMM-T317 - Open the MySQL Instance Summary Dashboard and verify Metrics are present and graphs are displayed for Percona Server for MySQL @pmm-ps-pxc-haproxy-integration @nightly @dashboards',
  async (data, { api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(data);

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceSummary.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstanceSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstanceSummary.metricsWithData);
  },
);

data(services).pmmTest(
  'PMM-T318 - Open the MySQL Instances Compare dashboard and verify Metrics are present and graphs are displayed @pmm-ps-pxc-haproxy-integration @nightly @dashboards',
  async (data, { api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(data);

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstancesCompare.url, {
        from: 'now-1h',
        refresh: '5s',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstancesCompare.metrics(service_name));
    await dashboard.verifyAllPanelsHaveData(
      dashboard.mysql.mysqlInstancesCompare.noDataMetrics(service_name),
    );
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstancesCompare.metricsWithData(service_name));
  },
);
data(services).pmmTest(
  'PMM-T319 - Open the MySQL Instances Overview dashboard and verify Metrics are present and graphs are displayed @pmm-ps-pxc-haproxy-integration @nightly @dashboards',
  async (data, { api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(data);

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceOverview.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstanceOverview.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceOverview.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstanceOverview.metricsWithData);
  },
);

pmmTest(
  'PMM-T324 - Verify MySQL - MySQL User Details dashboard @pmm-ps-integration @nightly @dashboards',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
      '^ps_pmm_replication_.*_1(_\\d+)?$',
      { replication_set: 'ps-async-replication' },
    );

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlUserDetails.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlUserDetails.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlUserDetails.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlUserDetails.metricsWithData);
  },
);

pmmTest(
  'PMM-T67 - Open the PXCGalera Cluster Summary Dashboard and verify Metrics are present and graphs are displayed @nightly @dashboards @pmm-ps-pxc-haproxy-integration',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.pxcGaleraClusterSummary.url, {
        from: 'now-1h',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.pxcGaleraClusterSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.pxcGaleraClusterSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.pxcGaleraClusterSummary.metricsWithData);
  },
);

pmmTest(
  'PMM-T349 - PXC/Galera Nodes Compare dashboard @pmm-ps-pxc-haproxy-integration @nightly @dashboards',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('pxc_node');

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.pxcGaleraNodesCompare.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.pxcGaleraNodesCompare.metrics(service_name));
    await dashboard.verifyAllPanelsHaveData(
      dashboard.mysql.pxcGaleraNodesCompare.noDataMetrics(service_name),
    );
    await dashboard.verifyPanelValues(dashboard.mysql.pxcGaleraNodesCompare.metricsWithData(service_name));
  },
);

pmmTest(
  'PMM-T430 - Verify metrics on MySQL Group Replication Summary Dashboard @pmm-ps-integration @nightly @dashboards',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlGroupReplicationSummary.url, {
        from: 'now-1h',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlGroupReplicationSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlGroupReplicationSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlGroupReplicationSummary.metricsWithData);
  },
);

pmmTest(
  'PMM-T2029 - Verify dashboard for MySQL Replication Summary @pmm-ps-integration',
  async ({ api, dashboard, page, urlHelper }) => {
    const service = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
      '^ps_pmm_replication_.*_2(_\\d+)?$',
      {
        replication_set: 'ps-async-replication',
      },
    );

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlReplicationSummary.url, {
        from: 'now-1h',
        serviceName: service.service_name,
      }),
    );
    await dashboard.selectVariableValue('Environment', 'ps-replication-dev');

    const services = await dashboard.getVariableValues('Service Name');

    expect(services.length).toBeGreaterThan(0);
    services.forEach((serviceName: string) => {
      expect(serviceName).toContain('replication');
    });
    await dashboard.verifyMetricsPresent(
      dashboard.mysql.mysqlReplicationSummary.metrics(service.service_name),
    );
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlReplicationSummary.noDataMetrics);
    await dashboard.verifyPanelValues(
      dashboard.mysql.mysqlReplicationSummary.metricsWithData(service.service_name),
      [service],
    );
  },
);

pmmTest(
  'PMM-T2079 - Verify metrics on MySQL MyRocks Details Dashboard @pmm-ps-integration @nightly @dashboards',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlMyRocksDetails.url, {
        from: 'now-1h',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlMyRocksDetails.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlMyRocksDetails.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlMyRocksDetails.metricsWithData);
  },
);

pmmTest(
  'PMM-T2331 - Verify Performance Schema Memory panels on MySQL Performance Schema Details Dashboard (PMM-12279) @pmm-ps-integration',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('ps_pmm');

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlPerformanceSchemaDetails.url, {
        from: 'now-15m',
        refresh: '5s',
        serviceName: service_name,
      }),
    );

    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlPerformanceSchemaDetails.memoryMetrics);

    await dashboard
      .panels()
      .timeSeries.verifyPanelData(dashboard.mysql.mysqlPerformanceSchemaDetails.memoryCurrentUsedPanel);
  },
);

pmmTest(
  'PMM-T348 - PXC/Galera Node Summary dashboard @dashboards @nightly',
  async ({ dashboard, page, urlHelper }) => {
    const nodeSummary = dashboard.mysql.pxcGaleraNodeSummary;

    await page.goto(
      urlHelper.buildUrlWithParameters(nodeSummary.url, { from: 'now-15m', refresh: '5s', to: 'now' }),
    );
    await dashboard.verifyMetricsPresent(nodeSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(nodeSummary.noDataMetrics);
  },
);

for (const panelName of ['Client Connections (All Host Groups)', 'PMM Upgrade'] as const) {
  pmmTest(
    `PMM-T1070 + PMM-T449 - Verify link to instructions for enabling rendering images @nightly @dashboards | ${panelName}`,
    async ({ dashboard, page, urlHelper }) => {
      const { url } = panelName === 'PMM Upgrade' ? dashboard.home : dashboard.mysql.proxysqlInstanceSummary;
      const pluginLink = dashboard.elements.imageRendererPluginLink;

      await page.goto(urlHelper.buildUrlWithParameters(url, { from: 'now-5m', refresh: '5s', to: 'now' }));
      await dashboard.waitForDashboardToLoad();
      await dashboard.openPanelShareLink(panelName);
      await expect(pluginLink).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
      await expect(pluginLink).toHaveAttribute('href', 'https://per.co.na/share_png');
      await expect(pluginLink).toHaveAttribute('target', '_blank');
      await expect(pluginLink).toHaveText('Image Renderer plugin');
      await expect(dashboard.elements.imageRendererPluginInfo).toContainText(
        'Image renderer plugin not installedTo render a panel image, you must install the Image Renderer plugin. Please contact your PMM administrator to install the plugin.',
      );
    },
  );
}

pmmTest(
  'PMM-T68 + PMM-T2038 - Open the ProxySQL Instance Summary Dashboard and verify Metrics are present and graphs are displayed @nightly @dashboards',
  async ({ dashboard, page, urlHelper }) => {
    const proxysql = dashboard.mysql.proxysqlInstanceSummary;
    const options = dashboard.elements.variableOptions;

    await page.goto(
      urlHelper.buildUrlWithParameters(proxysql.url, { from: 'now-5m', refresh: '5s', to: 'now' }),
    );

    await pmmTest.step('Select the first of the two ProxySQL instances', async () => {
      await dashboard.waitForDashboardToLoad();
      await dashboard.builders.templateVariableCombobox('ProxySQL Instance').click();
      await expect(options.visible()).toHaveCount(2);
      await options.first().click();
    });

    await dashboard.verifyMetricsPresent(proxysql.metrics);
    await dashboard.verifyAllPanelsHaveData(proxysql.noDataMetrics);

    await pmmTest.step('Open the Node Namegroup filter and verify its options', async () => {
      await dashboard.builders.templateVariableCombobox('Node Namegroup').click();
      await expect(options.visible()).toHaveCount(4);
    });
  },
);
