import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import QanApi from '@api/qan.api';
import { Timeouts } from '@helpers/timeouts';
import { AccessServiceType, AccessUserScenario } from '@interfaces/accessControl';
import { GetService } from '@interfaces/inventory';
import { admin } from '@testdata/datasourceProxy';
import { accessControlScenarios } from './accessControl.constants';

pmmTest.describe.configure({ mode: 'default' });

const scenarioFor = (serviceType: AccessServiceType): AccessUserScenario => {
  const scenario = accessControlScenarios.find((candidate) => candidate.serviceType === serviceType);

  if (!scenario) throw new Error(`No access control scenario for ${serviceType}`);

  return scenario;
};

const mysqlUser = scenarioFor('mysql');
const postgresUser = scenarioFor('postgresql');
// mysqld_exporter runs this query on every scrape, and its example has no placeholder that would break Explain.
const mysqlQueryText = 'SELECT * FROM `information_schema` . `client_statistics`';
// pmm-framework runs the school workload on PostgreSQL with pg_stat_monitor, which stores its plan.
const postgresQueryText = 'SELECT s.first_name';
const timeRangeHours = 6;
const detailMetrics = ['Query Count', 'Query Time'];
const noQueriesMessage = 'No queries available for this combination of filters in the selected time frame';
let mysqlService: GetService;
let postgresService: GetService;
let timeRange: { from: string; to: string };

pmmTest.beforeEach(async ({ accessControlHelper, api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await accessControlHelper.ensureScenarioUsers([mysqlUser, postgresUser]);
  mysqlService = await api.inventoryApi.getServiceDetailsByRegexAndParameters('ps_', {
    cluster: 'ps-single-dev-cluster',
  });
  postgresService = await api.inventoryApi.getServiceDetailsByRegex('^pdpgsql_pmm_(?!.*patroni).*$');

  // Ends a few minutes back so that late QAN buckets cannot change the values between two readings.
  const to = Date.now() - 3 * Timeouts.ONE_MINUTE;

  timeRange = { from: String(to - timeRangeHours * Timeouts.SIXTY_MINUTES), to: String(to) };
});

pmmTest(
  'PMM-T2422 - Verify a Viewer limited to MySQL sees no details for a PostgreSQL query opened from a copied link @LBAC',
  async ({ grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
    let queryUrl = '';

    await pmmTest.step('As the postgres user, open a PostgreSQL query and copy its address', async () => {
      await grafanaHelper.signInAs(postgresUser.username, postgresUser.password);
      await qanStoredMetrics.openQueryDetails(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          ...timeRange,
          search: postgresQueryText,
          serviceName: postgresService.service_name,
        }),
      );
      await qanStoredMetrics.getDetailMetricValues(detailMetrics);
      queryUrl = page.url();
      expect(queryUrl).toMatch(/[?&]filter_by=[^&]+/);
    });

    await pmmTest.step(
      'As the mysql user, the copied address lists no query and shows no details',
      async () => {
        await grafanaHelper.signInAs(mysqlUser.username, mysqlUser.password);
        await page.goto(queryUrl);
        await expect(qanStoredMetrics.elements.overviewNoData).toHaveText(noQueriesMessage, {
          timeout: Timeouts.ONE_MINUTE,
        });
        await expect(qanStoredMetrics.elements.detailsNoData).toHaveText(/^No data$/i, {
          timeout: Timeouts.THIRTY_SECONDS,
        });

        for (const metricName of detailMetrics) {
          await expect(qanStoredMetrics.builders.detailMetricValue(metricName, 3)).toBeHidden();
        }
      },
    );

    await pmmTest.step('As the mysql user, no example or plan of the query is shown', async () => {
      await qanStoredMetrics.builders.tab('Examples').click({ timeout: Timeouts.THIRTY_SECONDS });
      await qanStoredMetrics.waitForLoad();
      await expect(qanStoredMetrics.elements.noExamples).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      // The Plan tab belongs to PostgreSQL queries, and none is visible to this user.
      await expect(qanStoredMetrics.builders.tab('Plan')).toBeHidden();
    });

    await pmmTest.step('As Admin, the same address shows the query metrics', async () => {
      await grafanaHelper.signInAs(admin.username, admin.password);
      await page.goto(queryUrl);
      await qanStoredMetrics.getDetailMetricValues(detailMetrics);
      await expect(qanStoredMetrics.elements.detailsNoData).toBeHidden();
    });
  },
);

pmmTest(
  'PMM-T2423 - Verify Viewers limited by label still see the details, examples, explain and plan of their own queries @LBAC',
  async ({ grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
    let mysqlValues: Record<string, string[]> = {};
    let mysqlQueryUrl = '';

    await pmmTest.step('As the mysql user, open a MySQL query', async () => {
      await grafanaHelper.signInAs(mysqlUser.username, mysqlUser.password);
      await qanStoredMetrics.openQueryDetails(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          ...timeRange,
          search: mysqlQueryText,
          serviceName: mysqlService.service_name,
        }),
      );
      mysqlValues = await qanStoredMetrics.getDetailMetricValues(detailMetrics);
      mysqlQueryUrl = page.url();
    });

    await pmmTest.step('As the mysql user, Examples and Explain show the query', async () => {
      await qanStoredMetrics.openExamplesTab();
      await expect(qanStoredMetrics.elements.noExamples).toBeHidden();
      await qanStoredMetrics.verifyExplain();
    });

    await pmmTest.step('As Admin, the same query shows the same metric values', async () => {
      await grafanaHelper.signInAs(admin.username, admin.password);
      await page.goto(mysqlQueryUrl);
      await expect
        .poll(async () => await qanStoredMetrics.getDetailMetricValues(detailMetrics), {
          timeout: Timeouts.ONE_MINUTE,
        })
        .toEqual(mysqlValues);
    });

    await pmmTest.step('As the postgres user, open a PostgreSQL query', async () => {
      await grafanaHelper.signInAs(postgresUser.username, postgresUser.password);
      await qanStoredMetrics.openQueryDetails(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          ...timeRange,
          search: postgresQueryText,
          serviceName: postgresService.service_name,
        }),
      );
      await qanStoredMetrics.getDetailMetricValues(detailMetrics);
    });

    await pmmTest.step('As the postgres user, Examples and Plan show the query', async () => {
      await qanStoredMetrics.openExamplesTab();
      await expect(qanStoredMetrics.elements.noExamples).toBeHidden();
      await qanStoredMetrics.openPlanTab();
      await qanStoredMetrics.verifyPlanShown();
    });

    await pmmTest.step('As Admin, QAN lists queries of both services', async () => {
      await grafanaHelper.signInAs(admin.username, admin.password);
      await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, timeRange));
      await qanStoredMetrics.waitUntilQanStoredMetricsLoaded(Timeouts.ONE_MINUTE);

      for (const serviceType of ['mysql', 'postgresql']) {
        await expect(qanStoredMetrics.builders.serviceTypeCheckbox(serviceType)).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
      }
    });
  },
);

pmmTest(
  'PMM-T2424 - Verify a Viewer limited to MySQL gets no PostgreSQL query details from the QAN API @LBAC',
  async ({ api }) => {
    const qanApi = api.qanApi;
    const period = QanApi.period(timeRangeHours);
    const mysql = { password: mysqlUser.password, username: mysqlUser.username };
    let queryId = '';

    await pmmTest.step('Admin finds a PostgreSQL query with a stored plan', async () => {
      for (const candidate of await qanApi.getQueryIds(
        postgresService.service_name,
        postgresQueryText,
        period,
      )) {
        if ((await qanApi.getPlan(admin, candidate)).body.planid) {
          queryId = candidate;
          break;
        }
      }

      expect(
        queryId,
        `A query matching "${postgresQueryText}" with a plan on ${postgresService.service_name}`,
      ).not.toBe('');
    });

    await pmmTest.step('The mysql user gets no metrics, labels, example, plan or histogram', async () => {
      const metrics = await qanApi.getMetrics(mysql, queryId, period);

      expect(metrics.status, metrics.text).toEqual(200);
      expect(metrics.body.metrics ?? {}, metrics.text).toEqual({});

      const labels = await qanApi.getLabels(mysql, queryId, period);
      const labelValues = Object.values(labels.body.labels ?? {}).flatMap(({ values }) => values ?? []);

      expect(labels.status, labels.text).toEqual(200);
      expect(labelValues, labels.text).toEqual([]);

      const example = await qanApi.getExample(mysql, queryId, period);

      expect(example.status, example.text).toEqual(200);
      expect(example.body.query_examples ?? [], example.text).toEqual([]);

      const plan = await qanApi.getPlan(mysql, queryId);

      expect(plan.status, plan.text).toEqual(200);
      expect(plan.body.planid ?? '', plan.text).toEqual('');
      expect(plan.body.query_plan ?? '', plan.text).toEqual('');

      const histogram = await qanApi.getHistogram(mysql, queryId, period);

      expect(histogram.status, histogram.text).toEqual(200);
      expect(histogram.body.histogram_items ?? [], histogram.text).toEqual([]);
    });

    await pmmTest.step('The explain fingerprint fails as for a query id that does not exist', async () => {
      const missing = await qanApi.explainFingerprint(mysql, postgresService.service_id, '1');
      const fingerprint = await qanApi.explainFingerprint(mysql, postgresService.service_id, queryId);

      expect(missing.status).toBeGreaterThanOrEqual(400);
      expect({ body: fingerprint.body, status: fingerprint.status }).toEqual({
        body: missing.body,
        status: missing.status,
      });
    });

    await pmmTest.step('Admin gets metrics, labels, an example, the plan and histogram items', async () => {
      const metrics = await qanApi.getMetrics(admin, queryId, period);

      expect(metrics.body.metrics?.num_queries?.sum ?? 0, metrics.text).toBeGreaterThan(0);

      const labels = await qanApi.getLabels(admin, queryId, period);

      expect(labels.body.labels?.service_name?.values ?? [], labels.text).toContain(
        postgresService.service_name,
      );
      expect(
        (await qanApi.getExample(admin, queryId, period)).body.query_examples?.length ?? 0,
      ).toBeGreaterThan(0);
      expect((await qanApi.getPlan(admin, queryId)).body.planid ?? '').not.toEqual('');
      expect(
        (await qanApi.getHistogram(admin, queryId, period)).body.histogram_items?.length ?? 0,
      ).toBeGreaterThan(0);
    });
  },
);
