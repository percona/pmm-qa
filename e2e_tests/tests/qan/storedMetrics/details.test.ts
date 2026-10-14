import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
  await grafanaHelper.authorize();
  await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-30m', to: 'now' }));
  await qanStoredMetrics.waitForLoad();
});

pmmTest('PMM-T149 - Verify Details section tabs @qan', async ({ page, qanStoredMetrics }) => {
  await expect(async () => {
    await page.reload();
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.selectFilter(
      'pxc-dev-cluster',
      qanStoredMetrics.builders.serviceTypeCheckbox('pxc-dev-cluster'),
    );
  }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
  await qanStoredMetrics.selectRow(2);

  for (const tabName of ['Details', 'Examples', 'Explain', 'Tables']) {
    await expect(qanStoredMetrics.builders.tab(tabName)).toBeVisible({ timeout: Timeouts.FIVE_SECONDS });
  }
});

pmmTest(
  'PMM-T223 - Verify time metrics are AVG per query (not per second) @qan',
  async ({ page, qanStoredMetrics, urlHelper }) => {
    await expect(async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          environment: 'pxc-dev',
          from: 'now-1h',
          search: 'insert',
          to: 'now',
        }),
      );
      await expect(qanStoredMetrics.builders.queryRow(1)).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await qanStoredMetrics.selectRow(1);
    await expect(qanStoredMetrics.builders.detailMetricValue('Query Time', 3)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await qanStoredMetrics.verifyAveragePerQuery(3_600);
  },
);

pmmTest(
  'PMM-T245 - Verify that user is able to close the Details section @qan',
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.selectRow(1);
    await expect(qanStoredMetrics.buttons.closeDetails).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await qanStoredMetrics.buttons.closeDetails.click();
    await expect(qanStoredMetrics.buttons.closeDetails).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
  },
);

pmmTest(
  'PMM-T144 - Verify that Details tab is the only one available when total row is selected @qan',
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.builders.queryRow(0).click();
    await qanStoredMetrics.builders.tab('Details').click({ timeout: Timeouts.THIRTY_SECONDS });
    await qanStoredMetrics.waitForLoad();

    for (const tabName of ['Examples', 'Explain', 'Tables', 'Plan']) {
      await expect(qanStoredMetrics.builders.tab(tabName)).toBeHidden();
    }
  },
);

pmmTest.describe(() => {
  let containerName = '';

  pmmTest.beforeEach(({ cliHelper }) => {
    containerName = cliHelper
      .execute('docker ps --filter \'name=^ps_pmm_gr_.*_1$\' --format "{{.Names }}" | head -n 1')
      .assertSuccess()
      .stdout.trim();

    expect(containerName, 'No ps_pmm_gr_ primary (_1) container found').not.toBe('');
  });

  pmmTest.afterEach(({ cliHelper, credentials }) => {
    if (!containerName) return;

    const { password, username } = credentials.perconaServer;

    cliHelper
      .execute(
        `docker exec ${containerName} mysql -h 127.0.0.1 -u ${username} -p${password} --port 3306 -e "DROP DATABASE IF EXISTS pmm_t2014;"`,
      )
      .assertSuccess();
  });

  pmmTest(
    'PMM-T2014 - Verify explain tab in query analytics for query with explain in the name @pmm-ps-integration',
    async ({ cliHelper, credentials, page, qanStoredMetrics, urlHelper }) => {
      const { password, username } = credentials.perconaServer;

      cliHelper
        .execute(
          `docker exec ${containerName} mysql -h 127.0.0.1 -u ${username} -p${password} --port 3306 -e "CREATE DATABASE IF NOT EXISTS pmm_t2014; USE pmm_t2014; CREATE TABLE t1 (c1 INT NOT NULL, c2 VARCHAR(100) NOT NULL, PRIMARY KEY (c1)); insert into t1 values(1,1),(2,2),(3,3),(4,5); explain select * from t1 where c1=1; explain select * from t1 where c2=1; explain select * from t1 where c2>1 and c2<=3;"`,
        )
        .assertSuccess();
      await expect(async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-30m', to: 'now' }),
        );
        await qanStoredMetrics.waitForLoad();
        await qanStoredMetrics.searchByValue('explain select * from t1');
        await qanStoredMetrics.waitForLoad();
        await expect(qanStoredMetrics.elements.noData).toBeHidden();
        await expect(qanStoredMetrics.builders.queryRow(1)).toBeVisible();
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      await qanStoredMetrics.selectRow(1);
      await qanStoredMetrics.builders.tab('Explain').click({ timeout: Timeouts.THIRTY_SECONDS });

      for (const error of [
        qanStoredMetrics.elements.classicExplainError,
        qanStoredMetrics.elements.explainError,
      ]) {
        await expect(error).toHaveText(
          'Failed to create action: query EXPLAIN functionality is supported only for DML queries - SELECT, INSERT, UPDATE, DELETE and REPLACE',
          { timeout: Timeouts.THIRTY_SECONDS },
        );
      }
    },
  );
});

pmmTest(
  'PMM-T13 - Check Example, Explain, Plan and Table tabs for PS @qan',
  async ({ api, qanStoredMetrics, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegexAndParameters('ps_', {
      cluster: 'ps-single-dev-cluster',
    });

    for (const query of [
      'SELECT s.first_name',
      'INSERT INTO classes',
      'DELETE FROM students',
      'CREATE TABLE classes',
    ]) {
      await qanStoredMetrics.openQueryDetails(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          from: 'now-6h',
          search: query,
          serviceName: service_name,
          to: 'now',
        }),
      );
      await qanStoredMetrics.openExamplesTab();
      await expect(qanStoredMetrics.elements.noExamples).toBeHidden();

      if (!query.includes('CREATE')) await qanStoredMetrics.verifyExplain();
    }
  },
);

pmmTest(
  'PMM-T13 - Check Example, Explain, Plan and Table tabs for PDPGSQL @qan',
  async ({ api, qanStoredMetrics, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('^pdpgsql_pmm_(?!.*patroni).*$');

    for (const query of [
      'SELECT s.first_name',
      'INSERT INTO classes',
      'DELETE FROM',
      'CREATE TABLE classes ',
    ]) {
      await qanStoredMetrics.openQueryDetails(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          from: 'now-6h',
          search: query,
          serviceName: service_name,
          to: 'now',
        }),
      );
      await qanStoredMetrics.openExamplesTab();
      await expect(qanStoredMetrics.elements.noExamples).toBeHidden();

      if (!query.includes('CREATE')) await qanStoredMetrics.verifyTables();
      if (query.includes('SELECT')) await qanStoredMetrics.verifyPlan();
    }
  },
);

pmmTest(
  'PMM-T13 - Check Example, Explain, Plan and Table tabs for PSMDB @qan @gssapi-nightly',
  async ({ api, qanStoredMetrics, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
      process.env.JOB_NAME?.includes('gssapi') ? 'rs101_gssapi' : 'rs101',
      { cluster: 'replicaset' },
    );

    for (const query of ['db.students', 'db.runCommand', 'db.test']) {
      await qanStoredMetrics.openQueryDetails(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          from: 'now-6h',
          search: query,
          serviceName: service_name,
          to: 'now',
        }),
      );
      await qanStoredMetrics.openExamplesTab();
      await expect(qanStoredMetrics.elements.noExamples).toBeHidden();
      await qanStoredMetrics.verifyExplain(query.includes('runCommand'));
    }
  },
);

pmmTest(
  'PMM-T1790 - Verify that there is any no error on Explains after switching between queries from different DB servers @qan',
  async ({ page, qanStoredMetrics, urlHelper }) => {
    const psDev = qanStoredMetrics.builders.filterCheckboxInGroup('ps-dev', 'Environment');

    await expect(async () => {
      await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-1h', to: 'now' }));
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.selectFilter('ps-dev', psDev);
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.searchByQueryText('SELECT');
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.selectFirstWorkloadRow();
    await qanStoredMetrics.verifyNoExplainErrors();
    await qanStoredMetrics.selectFilter('ps-dev', psDev);
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.searchByValue('');
    await qanStoredMetrics.selectFilter(
      'mongodb',
      qanStoredMetrics.builders.filterCheckboxInGroup('mongodb', 'Service Type'),
    );
    await qanStoredMetrics.searchByQueryText('UPDATE');
    await qanStoredMetrics.selectRow(1);
    await qanStoredMetrics.verifyNoExplainErrors();
  },
);

pmmTest(
  'PMM-T1790 - Verify that there is any no error on Explains after switching between queries from different DB servers @gssapi-nightly',
  async ({ page, qanStoredMetrics, urlHelper }) => {
    await expect(async () => {
      await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-1h', to: 'now' }));
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.selectFilter(
        'mongodb',
        qanStoredMetrics.builders.filterCheckboxInGroup('mongodb', 'Service Type'),
      );
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await qanStoredMetrics.searchByQueryText('UPDATE');
    await qanStoredMetrics.selectRow(1);
    await qanStoredMetrics.verifyNoExplainErrors();
  },
);
