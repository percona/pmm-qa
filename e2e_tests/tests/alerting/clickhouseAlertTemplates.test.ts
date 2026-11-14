import pmmTest from '@fixtures/pmmTest';
import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { AlertRuleFilter } from '@interfaces/alerting';
import AlertingApi from '@api/alerting.api';
import InventoryApi from '@api/inventory.api';
import { expect } from '@playwright/test';
import {
  qanAlertLabels,
  qanFiltersHint,
  qanTemplate,
  rejectedClickHouseTemplates,
  userTemplate,
} from '@testdata/clickhouseAlertTemplates';

pmmTest.describe.configure({ mode: 'default' });

interface QanService {
  container: string;
  environment: string;
  nodeId: string;
  nodeName: string;
  serviceName: string;
}

const folderTitle = 'PMM-15193 ClickHouse alert templates';
// QAN reports in 1-minute buckets 1–2 minutes late, and the rule reads the last 5 minutes.
const qanFiringTimeout = Timeouts.FIVE_MINUTES;
const qanResolveTimeout = Timeouts.TEN_MINUTES;
let folderUid: string;
const rejectedName = (index: number) => `qa_qan_bad_${index}`;

const findQanService = async (inventoryApi: InventoryApi, agentType: string): Promise<QanService> => {
  const agent = (await inventoryApi.getAgents())[agentType]?.find(({ disabled }) => !disabled);

  if (!agent) throw new Error(`No running ${agentType}: the test needs a service with Query Analytics`);

  const service = (await inventoryApi.getServices()).services.find(
    ({ service_id }) => service_id === agent.service_id,
  );

  if (!service) throw new Error(`Service ${agent.service_id} of ${agentType} is not listed`);

  // pmm-framework names each client node after its database container.
  return {
    container: service.node_name,
    environment: service.environment,
    nodeId: service.node_id,
    nodeName: service.node_name,
    serviceName: service.service_name,
  };
};

const qanServices = async (inventoryApi: InventoryApi) => ({
  mysql: await findQanService(inventoryApi, 'qan_mysql_slowlog_agent'),
  postgresql: await findQanService(inventoryApi, 'qan_postgresql_pgstatements_agent'),
});

// The SELECT 'qa_slow' keeps the PostgreSQL query apart from pmm-framework's own pg_sleep() load:
// pg_stat_statements gives every database the same query ID, and Query Analytics keeps one row per ID.
const runSlowQueries = (cliHelper: CliHelper, credentials: Credentials, services: QanService[]) => {
  for (const { container } of services) {
    const command = container.startsWith('ps_')
      ? `mysql -u${credentials.perconaServer.username} -p${credentials.perconaServer.password} -e "SELECT SLEEP(12)"`
      : `psql -U postgres -c "SELECT 'qa_slow', pg_sleep(12)"`;

    cliHelper.execute(`docker exec --detach ${container} ${command}`).assertSuccess();
  }
};

const firingServices = async (alertingApi: AlertingApi, ruleName: string) =>
  ((await alertingApi.getRule(ruleName))?.alerts ?? [])
    .filter(({ state }) => state === 'Alerting')
    .map(({ labels }) => labels.service_name)
    .sort();
// Every instance carries the measured time, firing or not, so this tells when a slow query has reached the rule.
const measuredSlowQuery = async (alertingApi: AlertingApi, ruleName: string, serviceName: string) =>
  ((await alertingApi.getRule(ruleName))?.alerts ?? []).some(
    ({ annotations, labels }) =>
      labels.service_name === serviceName && /took 12\.\d\ds/.test(annotations?.description ?? ''),
  );
const createQanRule = (
  alertingApi: AlertingApi,
  name: string,
  threshold: number,
  filters?: AlertRuleFilter[],
) =>
  alertingApi.createFastRuleFromTemplate({
    filters,
    folderUid,
    name,
    templateName: qanTemplate.name,
    threshold,
  });

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  folderUid = '';
  await grafanaHelper.authorize();
  await api.alertingApi.removeAllAlertRules();
  await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), userTemplate.name);
  folderUid = await api.grafanaApi.createFolder(folderTitle);
});

pmmTest.afterEach(async ({ api }) => {
  await api.alertingApi.removeAllAlertRules();

  if (folderUid) await api.grafanaApi.deleteFolder(folderUid);

  await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), userTemplate.name);

  for (const index of rejectedClickHouseTemplates.keys()) {
    await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), rejectedName(index));
  }
});

pmmTest(
  'PMM-15193 - Verify the QAN slow queries built-in template is listed as Dynamic and its create form shows the ClickHouse query steps @fb-alerting',
  async ({ alertingPage, api }) => {
    await pmmTest.step('The template is a Dynamic built-in template', async () => {
      await alertingPage.openTemplates();
      await expect(alertingPage.builders.dynamicBadge(qanTemplate.summary)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.builders.templateRow(qanTemplate.summary)).toContainText('Built-in');
    });

    await pmmTest.step(
      'View shows a ClickHouse query, a max reduce and the threshold condition',
      async () => {
        for (const text of [
          /datasource: clickhouse/,
          /type: reduce/,
          /reducer: max/,
          /expression: \$B > \[\[ \.threshold ]]/,
          /condition: C/,
        ]) {
          await alertingPage.verifyTemplateText(qanTemplate.summary, text);
        }
      },
    );

    await pmmTest.step(
      'The API reports the datasource, the reducer and an overridable threshold',
      async () => {
        const template = await api.alertingApi.getTemplate(qanTemplate.name);

        expect(template.queries).toEqual([
          expect.objectContaining({ datasource: 'DATASOURCE_TYPE_CLICKHOUSE', ref_id: 'A' }),
        ]);
        expect(template.expressions).toEqual([
          expect.objectContaining({ expression: '$A', reducer: 'max', ref_id: 'B', type: 'reduce' }),
          expect.objectContaining({ expression: '$B > [[ .threshold ]]', ref_id: 'C', type: 'math' }),
        ]);
        expect(template.condition).toBe('C');
        expect(template.params).toEqual([
          expect.objectContaining({
            float: { default: 10, max: 3_600, min: 0 },
            name: 'threshold',
            overridable: true,
            type: 'PARAM_TYPE_FLOAT',
            unit: 'PARAM_UNIT_SECONDS',
          }),
        ]);
      },
    );

    await pmmTest.step('The create form shows query A on ClickHouse and the reduce step', async () => {
      await alertingPage.builders.createRuleFromTemplate(qanTemplate.summary).click();
      await alertingPage.openAdvancedDetails();
      await expect(alertingPage.builders.templateQueryDatasource('A')).toHaveText('ClickHouse');
      await expect(alertingPage.builders.templateQuery('A')).toContainText('FROM pmm.metrics');
      await expect(alertingPage.builders.templateExpression('B')).toContainText('reduce(max): $A');
      await expect(alertingPage.builders.templateExpression('C')).toContainText('$B > [[ .threshold ]]');
      await expect(alertingPage.elements.templateCondition).toContainText('C');
      await expect(
        alertingPage.elements.pageContent.getByText(qanFiltersHint, { exact: false }),
      ).toBeVisible();
    });

    await pmmTest.step('A MetricsQL template shows a Metrics badge and no Query Analytics hint', async () => {
      await alertingPage.chooseOption(alertingPage.inputs.templateSelect, 'Node high CPU load');
      await expect(alertingPage.builders.templateQueryDatasource('A')).toHaveText('Metrics');
      await expect(alertingPage.builders.templateExpression('B')).toHaveCount(0);
      await expect(alertingPage.elements.pageContent.getByText(qanFiltersHint, { exact: false })).toHaveCount(
        0,
      );
    });
  },
);

pmmTest(
  'PMM-15193 - Verify a QAN slow queries rule fires only for services with a slow query, shows its steps on the Alerts page and resolves on its own @fb-alerting',
  async ({ alertingPage, alertStatusPage, api, cliHelper, credentials }) => {
    pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

    const ruleName = 'qan-slow-5';
    const { mysql, postgresql } = await qanServices(api.inventoryApi);
    const slowServices = [mysql.serviceName, postgresql.serviceName].sort();

    await createQanRule(api.alertingApi, ruleName, 5);
    runSlowQueries(cliHelper, credentials, [mysql, postgresql]);

    await pmmTest.step('The rule fires for the MySQL and PostgreSQL services only', async () => {
      await expect
        .poll(() => firingServices(api.alertingApi, ruleName), { timeout: qanFiringTimeout })
        .toEqual(slowServices);

      const rule = await api.alertingApi.getRule(ruleName);

      expect(rule?.state).toBe('firing');
      expect(rule?.alerts?.filter(({ state }) => /error/i.test(state)) ?? []).toEqual([]);
    });

    await pmmTest.step(
      'Each alert has the node and service labels, the summary and the description',
      async () => {
        for (const { nodeName, serviceName } of [mysql, postgresql]) {
          const [alert] = await api.alertingApi.getRuleAlerts(ruleName, 'service_name', serviceName, {
            activeOnly: true,
          });

          for (const label of qanAlertLabels) expect(Object.keys(alert.labels)).toContain(label);

          expect(alert.labels.node_name).toBe(nodeName);
          expect(alert.labels.severity).toBe('warning');
          expect(alert.annotations?.summary).toBe(`Slow queries on ${serviceName} (${nodeName})`);
          expect(alert.annotations?.description).toMatch(
            new RegExp(`A query class on ${serviceName} took 12\\.\\d\\ds, more than 5s\\.`),
          );
        }
      },
    );

    await pmmTest.step(
      'The Alerts page lists the SQL query, threshold, reduce and condition steps',
      async () => {
        await alertStatusPage.openAlertDetails(ruleName, mysql.serviceName);
        await expect(alertStatusPage.elements.ruleSteps).toHaveCount(4);
        await expect(alertStatusPage.builders.ruleStep('A')).toContainText('A · SQL query');
        await expect(alertStatusPage.builders.ruleStep('A')).toContainText('FROM pmm.metrics');
        await expect(alertStatusPage.builders.ruleStep('T_threshold')).toContainText(
          'Per-target threshold: the override set for the target, or the rule default.',
        );
        await expect(alertStatusPage.builders.ruleStep('B')).toContainText('B · Reduce');
        await expect(alertStatusPage.builders.ruleStep('B')).toContainText('max($A)');
        await expect(alertStatusPage.builders.ruleStep('C')).toContainText('C · Math · condition');
        await expect(alertStatusPage.builders.ruleStep('C')).toContainText('$B > $T_threshold');
        // Value / Threshold, e.g. "12 / 5 (140% over)" or "12.01 / 5 (140% over)".
        await expect(
          alertStatusPage.builders.detailsParagraph(/^12(\.\d+)? \/ 5 \(\d+% over\)$/),
        ).toBeVisible();
      },
    );

    await pmmTest.step(
      'Grafana runs query A on ClickHouse as SQL time series, and Preview has no errors',
      async () => {
        const uid = await api.alertingApi.getRuleUid(ruleName);
        const [query, , reduce] = (await api.alertingApi.getProvisionedRule(uid)).data;

        expect(query.model).toEqual(expect.objectContaining({ editorType: 'sql', queryType: 'timeseries' }));
        expect(reduce.model.reducer).toBe('max');

        await alertingPage.openRuleEditor(uid);
        // The picker shows the selected datasource as its placeholder.
        await expect(
          alertingPage.elements.dataSourcePicker.first().getByPlaceholder('ClickHouse'),
        ).toBeVisible();

        const results = await alertingPage.previewRule();

        for (const [refId, { error, status }] of Object.entries(results)) {
          expect(error, `step ${refId} of the preview`).toBeUndefined();
          expect(status, `step ${refId} of the preview`).toBe(200);
        }

        expect(results.B.frames?.length).toBeGreaterThanOrEqual(slowServices.length);
      },
    );

    await pmmTest.step('The alerts resolve once the slow queries leave the 5-minute window', async () => {
      await expect
        .poll(() => firingServices(api.alertingApi, ruleName), {
          intervals: [Timeouts.TEN_SECONDS],
          timeout: qanResolveTimeout,
        })
        .toEqual([]);
    });
  },
);

pmmTest(
  'PMM-15193 - Verify filters narrow QAN slow queries alerts by the labels the query returns @fb-alerting',
  async ({ api, cliHelper, credentials }) => {
    pmmTest.setTimeout(Timeouts.TEN_MINUTES);

    const { mysql, postgresql } = await qanServices(api.inventoryApi);

    expect(mysql.environment, 'pmm-framework gives the MySQL service an environment').not.toBe('');
    expect(postgresql.environment, 'and leaves the PostgreSQL service without one').toBe('');

    const both = [mysql.serviceName, postgresql.serviceName].sort();
    const rules: { expected: string[]; filter: AlertRuleFilter; name: string }[] = [
      {
        expected: [mysql.serviceName],
        filter: { label: 'service_name', regexp: mysql.serviceName, type: 'FILTER_TYPE_MATCH' },
        name: 'qan-service-match',
      },
      {
        expected: [postgresql.serviceName],
        filter: { label: 'service_name', regexp: mysql.serviceName, type: 'FILTER_TYPE_MISMATCH' },
        name: 'qan-service-mismatch',
      },
      {
        // An empty value counts as a match, as for metrics.
        expected: both,
        filter: { label: 'environment', regexp: mysql.environment, type: 'FILTER_TYPE_MATCH' },
        name: 'qan-environment-match',
      },
      {
        expected: [postgresql.serviceName],
        filter: { label: 'environment', regexp: mysql.environment, type: 'FILTER_TYPE_MISMATCH' },
        name: 'qan-environment-mismatch',
      },
      {
        expected: both,
        filter: { label: 'agent_type', regexp: 'x.*', type: 'FILTER_TYPE_MATCH' },
        name: 'qan-missing-label-match',
      },
    ];

    for (const { filter, name } of rules) await createQanRule(api.alertingApi, name, 5, [filter]);

    await createQanRule(api.alertingApi, 'qan-missing-label-mismatch', 5, [
      { label: 'agent_type', regexp: '.*', type: 'FILTER_TYPE_MISMATCH' },
    ]);
    runSlowQueries(cliHelper, credentials, [mysql, postgresql]);

    for (const { expected, filter, name } of rules) {
      await pmmTest.step(
        `${filter.label} ${filter.type} ${filter.regexp} fires for ${expected.join(', ')}`,
        async () => {
          await expect
            .poll(() => firingServices(api.alertingApi, name), { timeout: qanFiringTimeout })
            .toEqual(expected);
        },
      );
    }

    await pmmTest.step(
      'A MISMATCH on a label the query never returns fires for nothing, without errors',
      async () => {
        const rule = await api.alertingApi.getRule('qan-missing-label-mismatch');

        expect(await firingServices(api.alertingApi, 'qan-missing-label-mismatch')).toEqual([]);
        expect(rule?.state).toBe('inactive');
        expect(rule?.alerts?.map(({ state }) => state)).toEqual(['Normal (NoData)']);
      },
    );

    await pmmTest.step('Grafana wraps the rule SQL in the filter', async () => {
      const match = await api.alertingApi.getProvisionedRule(
        await api.alertingApi.getRuleUid('qan-service-match'),
      );
      const mismatch = await api.alertingApi.getProvisionedRule(
        await api.alertingApi.getRuleUid('qan-environment-mismatch'),
      );

      expect(match.data[0].model.rawSql).toMatch(/^SELECT \* FROM \(/);
      expect(match.data[0].model.rawSql).toContain(
        `WHERE match(arrayStringConcat([COLUMNS('^service_name$')]), '^(?:(?:${mysql.serviceName})|)$')`,
      );
      expect(mismatch.data[0].model.rawSql).toContain(
        `WHERE NOT match(arrayStringConcat([COLUMNS('^environment$')]), '^(?:${mysql.environment})$')`,
      );
    });
  },
);

pmmTest(
  'PMM-15193 - Verify a rule with an invalid filter label or regular expression is refused @fb-alerting',
  async ({ alertingPage, api, page }) => {
    const invalidLabel = "Invalid filter: filter label 'service name' is not a valid label name.";
    const invalidRegexp = "Invalid filter: filter regexp for label 'service_name' is invalid:";

    await pmmTest.step('The create form refuses a label with a space', async () => {
      await page.goto(alertingPage.urls.alertRuleFromTemplate);
      await alertingPage.chooseOption(alertingPage.inputs.templateSelect, qanTemplate.summary);
      await alertingPage.inputs.ruleName.fill('qan-invalid-filter');
      await alertingPage.inputs.threshold.fill('5');
      await alertingPage.addFilter('service name', 'MATCH', 'x');
      await alertingPage.completeRuleFromTemplate('Warning');
      await alertingPage.buttons.saveRuleAndExit.click();
      await expect(alertingPage.builders.alertMessage(invalidLabel)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(alertingPage.urls.alertRuleFromTemplate));
    });

    await pmmTest.step('The create form refuses an invalid regular expression', async () => {
      await alertingPage.builders.filterRow(0).getByPlaceholder('Label').fill('service_name');
      await alertingPage.builders.filterRow(0).getByPlaceholder('Regex').fill('(');
      await alertingPage.buttons.saveRuleAndExit.click();
      await expect(alertingPage.builders.alertMessage(invalidRegexp)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(alertingPage.urls.alertRuleFromTemplate));
    });

    await pmmTest.step('A MetricsQL template refuses the same filters', async () => {
      for (const [filter, message] of [
        [{ label: 'service name', regexp: 'x', type: 'FILTER_TYPE_MATCH' }, invalidLabel],
        [{ label: 'service_name', regexp: '(', type: 'FILTER_TYPE_MISMATCH' }, invalidRegexp],
      ] as const) {
        const response = await api.alertingApi.createRule(GrafanaHelper.getAuthHeader(), {
          filters: [filter],
          folder_uid: folderUid,
          group: 'fast-rules',
          name: 'cpu-invalid-filter',
          params: [{ float: 80, name: 'threshold', type: 'PARAM_TYPE_FLOAT' }],
          template_name: 'pmm_node_high_cpu_load',
        });

        expect(response.status()).toBe(400);
        expect(((await response.json()) as { message: string }).message).toContain(message);
      }
    });

    await pmmTest.step('No refused rule is created', async () => {
      expect(await api.alertingApi.getRule('qan-invalid-filter')).toBeUndefined();
      expect(await api.alertingApi.getRule('cpu-invalid-filter')).toBeUndefined();
    });
  },
);

pmmTest(
  'PMM-15193 - Verify a node threshold override applies to a QAN slow queries rule only on that node @fb-alerting',
  async ({ alertThresholdsPage, api, cliHelper, credentials, nodesPage, page }) => {
    pmmTest.setTimeout(Timeouts.TEN_MINUTES);

    const ruleName = 'qan-slow-15';
    const { mysql, postgresql } = await qanServices(api.inventoryApi);

    expect(mysql.nodeId, 'the services must run on different nodes').not.toBe(postgresql.nodeId);
    await createQanRule(api.alertingApi, ruleName, 15);

    await pmmTest.step('Override the threshold to 5 on the MySQL node', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(mysql.nodeName);
      await alertThresholdsPage.verifyDefault(ruleName, 15, 's');
      await alertThresholdsPage.saveOverride(ruleName, '5');
      await nodesPage.openAlertThresholds(mysql.nodeName);
      await alertThresholdsPage.verifyOverride(ruleName, '5');
      await alertThresholdsPage.buttons.cancel.click();
    });

    runSlowQueries(cliHelper, credentials, [mysql, postgresql]);

    await pmmTest.step('A 12s query fires on the MySQL node only', async () => {
      await expect
        .poll(() => firingServices(api.alertingApi, ruleName), { timeout: qanFiringTimeout })
        .toEqual([mysql.serviceName]);

      const [alert] = await api.alertingApi.getRuleAlerts(ruleName, 'service_name', mysql.serviceName, {
        activeOnly: true,
      });

      expect(alert.annotations?.description).toContain('more than 5s');
    });

    await pmmTest.step('PostgreSQL keeps the default of 15', async () => {
      await expect
        .poll(() => measuredSlowQuery(api.alertingApi, ruleName, postgresql.serviceName), {
          timeout: qanFiringTimeout,
        })
        .toBe(true);
      expect(await firingServices(api.alertingApi, ruleName)).toEqual([mysql.serviceName]);
    });

    await pmmTest.step('Resetting the override resolves the MySQL alert', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(mysql.nodeName);
      await alertThresholdsPage.resetOverride(ruleName);
      await nodesPage.openAlertThresholds(mysql.nodeName);
      await alertThresholdsPage.verifyOverride(ruleName, '15');
      await expect
        .poll(() => firingServices(api.alertingApi, ruleName), { timeout: Timeouts.TWO_MINUTES })
        .toEqual([]);
    });
  },
);

pmmTest(
  'PMM-15193 - Verify a user template with a ClickHouse query can be added and its rules fire @fb-alerting',
  async ({ alertingPage, api }) => {
    pmmTest.setTimeout(Timeouts.TEN_MINUTES);

    const { mysql, postgresql } = await qanServices(api.inventoryApi);

    await pmmTest.step('Add the template', async () => {
      await alertingPage.openTemplates();
      await alertingPage.createTemplate(userTemplate.yaml);
      await expect(alertingPage.messages.popUp).toContainText('Alert rule template successfully added');
      await expect(alertingPage.builders.templateRow(userTemplate.summary)).toContainText(
        'User Created (UI)',
      );
      await expect(alertingPage.builders.dynamicBadge(userTemplate.summary)).toHaveCount(0);
    });

    await pmmTest.step(
      'A rule and a rule filtered on a label the query does not return both fire',
      async () => {
        for (const [name, filters] of [
          ['qan-count', undefined],
          ['qan-count-region', [{ label: 'region', regexp: 'eu', type: 'FILTER_TYPE_MATCH' }]],
        ] as const) {
          await api.alertingApi.createFastRuleFromTemplate({
            filters: filters ? [...filters] : undefined,
            folderUid,
            name,
            templateName: userTemplate.name,
            threshold: 0,
          });
        }

        for (const name of ['qan-count', 'qan-count-region']) {
          await expect
            .poll(() => firingServices(api.alertingApi, name), { timeout: qanFiringTimeout })
            .toEqual(expect.arrayContaining([mysql.serviceName, postgresql.serviceName]));

          const [alert] = await api.alertingApi.getRuleAlerts(name, 'service_name', mysql.serviceName, {
            activeOnly: true,
          });

          expect(alert.annotations?.description).toMatch(
            new RegExp(`^${mysql.serviceName} ran \\S+ queries\\.$`),
          );
        }
      },
    );
  },
);

for (const [index, { change, edit, message }] of rejectedClickHouseTemplates.entries()) {
  pmmTest(
    `PMM-15193 - Verify a user template with ${change} is refused with a clear message @fb-alerting`,
    async ({ alertingPage, page }) => {
      const name = rejectedName(index);

      await alertingPage.openTemplates();
      await alertingPage.verifyTemplateRefused(
        edit(userTemplate.yaml).replace(userTemplate.name, name),
        message,
      );
      await page.reload();
      await expect(alertingPage.builders.templateRow(qanTemplate.summary)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.builders.templateRow(name)).toHaveCount(0);
    },
  );
}

pmmTest(
  'PMM-15193 - Verify an edit that breaks a ClickHouse user template is refused and the template is kept @fb-alerting',
  async ({ alertingPage, api }) => {
    await api.alertingApi.uploadTemplate(userTemplate.yaml);
    await alertingPage.openTemplates();
    await alertingPage.builders.editTemplate(userTemplate.summary).click();
    await expect(alertingPage.inputs.template).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.inputs.template.fill(rejectedClickHouseTemplates[2].edit(userTemplate.yaml));
    await alertingPage.buttons.saveTemplate.click();
    // The edit path does not name the reason, unlike Add.
    await expect(alertingPage.messages.popUp).toContainText('Failed to parse rule template');

    const template = await api.alertingApi.getTemplate(userTemplate.name);

    expect(template.expressions?.find(({ ref_id }) => ref_id === 'B')?.reducer).toBe('sum');
  },
);
