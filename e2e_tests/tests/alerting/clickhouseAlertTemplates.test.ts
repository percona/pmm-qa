import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { AlertRuleFilter } from '@interfaces/alerting';
import { expect } from '@playwright/test';
import {
  qanAlertLabels,
  qanTemplate,
  refusedTemplate,
  rejectedClickHouseTemplates,
  rejectedName,
  unsupportedReducer,
  userTemplate,
} from '@testdata/clickhouseAlertTemplates';

pmmTest.describe.configure({ mode: 'default' });

const folderTitle = 'PMM-15193 ClickHouse alert templates';
const qanFiringTimeout = Timeouts.FIVE_MINUTES;
const qanResolveTimeout = Timeouts.FIVE_MINUTES + Timeouts.TWO_MINUTES + Timeouts.ONE_MINUTE;
const mysqlQan = 'qan-mysql-slowlog-agent';
const postgresqlQan = 'qan-postgresql-pgstatements-agent';
let folderUid: string;

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
  'PMM-Txxxx - Verify the QAN slow queries built-in template is listed as Dynamic and its create form shows the ClickHouse query steps @fb-alerting',
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
        await alertingPage.verifyTemplateText(qanTemplate.summary, [
          /datasource: clickhouse/,
          /type: reduce/,
          /reducer: max/,
          /expression: \$B > \[\[ \.threshold ]]/,
          /condition: C/,
        ]);
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
      await expect(alertingPage.elements.templateConditionValue).toHaveText('C');
      await expect(alertingPage.messages.qanFiltersHint).toBeVisible();
    });

    await pmmTest.step('A MetricsQL template shows a Metrics badge and no Query Analytics hint', async () => {
      await alertingPage.chooseOption(alertingPage.inputs.templateSelect, 'Node high CPU load');
      await expect(alertingPage.builders.templateQueryDatasource('A')).toHaveText('Metrics');
      await expect(alertingPage.builders.templateExpression('B')).toHaveCount(0);
      await expect(alertingPage.messages.qanFiltersHint).toHaveCount(0);
    });
  },
);

pmmTest(
  'PMM-Txxxx - Verify a QAN slow queries rule fires only for services with a slow query, shows its steps on the Alerts page and resolves on its own @fb-alerting',
  async ({ alertingPage, alertStatusPage, api, dockerHelper }) => {
    const ruleName = 'qan-slow-5';
    const mysql = await api.inventoryApi.getQanService(mysqlQan);
    const postgresql = await api.inventoryApi.getQanService(postgresqlQan);
    const slowServices = [mysql.service_name, postgresql.service_name].sort();

    await api.alertingApi.createFastRuleFromTemplate({
      folderUid,
      name: ruleName,
      templateName: qanTemplate.name,
      threshold: 5,
    });
    dockerHelper.runSlowQueries([mysql, postgresql]);

    await pmmTest.step('The rule fires for the MySQL and PostgreSQL services only', async () => {
      await expect
        .poll(() => api.alertingApi.getFiringServices(ruleName), { timeout: qanFiringTimeout })
        .toEqual(slowServices);

      const rule = await api.alertingApi.getRule(ruleName);

      expect(rule?.state).toBe('firing');
      expect(rule?.alerts?.filter(({ state }) => /error/i.test(state)) ?? []).toEqual([]);
    });

    await pmmTest.step(
      'Each alert has the node and service labels, the summary and the description',
      async () => {
        for (const service of [mysql, postgresql]) {
          const { node_name, service_name } = service;
          const alerts = await api.alertingApi.getRuleAlerts(ruleName, 'service_name', service_name, {
            activeOnly: true,
          });

          expect(alerts).toHaveLength(1);

          const [{ annotations, labels }] = alerts;

          expect(Object.keys(labels)).toEqual(expect.arrayContaining(qanAlertLabels));
          expect(labels).toEqual(
            expect.objectContaining({
              cluster: service.cluster,
              environment: service.environment,
              node_id: service.node_id,
              node_name,
              service_id: service.service_id,
              service_type: service.service_type,
              severity: 'warning',
            }),
          );
          expect(annotations?.summary).toBe(`Slow queries on ${service_name} (${node_name})`);
          expect(annotations?.description).toMatch(
            new RegExp(`A query class on ${service_name} took 12\\.\\d\\ds, more than 5s\\.`),
          );
        }
      },
    );

    await pmmTest.step(
      'The Alerts page lists the SQL query, threshold, reduce and condition steps',
      async () => {
        await alertStatusPage.openAlertDetails(ruleName, mysql.service_name);
        await expect(alertStatusPage.elements.ruleSteps).toHaveCount(4);
        await expect(alertStatusPage.builders.ruleStepHeading('A')).toHaveText('A · SQL query');
        await expect(alertStatusPage.builders.ruleStep('A')).toContainText('FROM pmm.metrics');
        await expect(alertStatusPage.builders.ruleStepHeading('T_threshold')).toHaveText(
          'T_threshold · Threshold',
        );
        await expect(alertStatusPage.builders.ruleStep('T_threshold')).toContainText(
          'Per-target threshold: the override set for the target, or the rule default.',
        );
        await expect(alertStatusPage.builders.ruleStepHeading('B')).toHaveText('B · Reduce');
        await expect(alertStatusPage.builders.ruleStep('B')).toContainText('max($A)');
        await expect(alertStatusPage.builders.ruleStepHeading('C')).toHaveText('C · Math · condition');
        await expect(alertStatusPage.builders.ruleStep('C')).toContainText('$B > $T_threshold');
        await expect(
          alertStatusPage.builders.detailsParagraph(/^12(\.\d+)? \/ 5 \((\d+% )?over\)$/),
        ).toBeVisible();
      },
    );

    await pmmTest.step(
      'Grafana runs query A on ClickHouse as SQL time series, and Preview has no errors',
      async () => {
        const uid = await api.alertingApi.getRuleUid(ruleName);
        const { data } = await api.alertingApi.getProvisionedRule(uid);
        const query = data.find(({ refId }) => refId === 'A');
        const reduce = data.find(({ refId }) => refId === 'B');

        expect(query?.model).toEqual(
          expect.objectContaining({ editorType: 'sql', intervalMs: 60_000, queryType: 'timeseries' }),
        );
        expect(query?.relativeTimeRange?.from).toBe(300);
        expect(reduce?.model).toEqual(
          expect.objectContaining({ reducer: 'max', settings: { mode: 'dropNN' } }),
        );

        await alertingPage.openRuleEditor(uid);
        await expect(alertingPage.builders.dataSource('ClickHouse')).toHaveCount(1);

        const results = await alertingPage.previewRule();

        for (const [refId, { error, status }] of Object.entries(results)) {
          expect(error, `step ${refId} of the preview`).toBeUndefined();
          expect(status, `step ${refId} of the preview`).toBe(200);
        }

        expect(results.B.frames).toHaveLength(slowServices.length);
      },
    );

    await pmmTest.step('The alerts resolve once the slow queries leave the 5-minute window', async () => {
      await expect
        .poll(() => api.alertingApi.getFiringServices(ruleName), {
          intervals: [Timeouts.TEN_SECONDS],
          timeout: qanResolveTimeout,
        })
        .toEqual([]);
      expect(
        ((await api.alertingApi.getRule(ruleName))?.alerts ?? []).filter(
          ({ state }) => !state.startsWith('Normal'),
        ),
        'every instance is back to Normal, none in an error state',
      ).toEqual([]);
    });
  },
);

pmmTest(
  'PMM-Txxxx - Verify filters narrow QAN slow queries alerts by the labels the query returns @fb-alerting',
  async ({ api, dockerHelper }) => {
    const mysql = await api.inventoryApi.getQanService(mysqlQan);
    const postgresql = await api.inventoryApi.getQanService(postgresqlQan);

    expect(mysql.environment, 'pmm-framework gives the MySQL service an environment').not.toBe('');
    expect(postgresql.environment, 'and leaves the PostgreSQL service without one').toBe('');

    const both = [mysql.service_name, postgresql.service_name].sort();
    const rules: { expected: string[]; filter: AlertRuleFilter; name: string }[] = [
      {
        expected: [mysql.service_name],
        filter: { label: 'service_name', regexp: mysql.service_name, type: 'FILTER_TYPE_MATCH' },
        name: 'qan-service-match',
      },
      {
        expected: [postgresql.service_name],
        filter: { label: 'service_name', regexp: mysql.service_name, type: 'FILTER_TYPE_MISMATCH' },
        name: 'qan-service-mismatch',
      },
      {
        // An empty value counts as a match, as for metrics.
        expected: both,
        filter: { label: 'environment', regexp: mysql.environment, type: 'FILTER_TYPE_MATCH' },
        name: 'qan-environment-match',
      },
      {
        expected: [postgresql.service_name],
        filter: { label: 'environment', regexp: mysql.environment, type: 'FILTER_TYPE_MISMATCH' },
        name: 'qan-environment-mismatch',
      },
      {
        expected: both,
        filter: { label: 'agent_type', regexp: 'x.*', type: 'FILTER_TYPE_MATCH' },
        name: 'qan-missing-label-match',
      },
      {
        expected: [],
        filter: { label: 'agent_type', regexp: '.*', type: 'FILTER_TYPE_MISMATCH' },
        name: 'qan-missing-label-mismatch',
      },
    ];

    for (const { filter, name } of rules) {
      await api.alertingApi.createFastRuleFromTemplate({
        filters: [filter],
        folderUid,
        name,
        templateName: qanTemplate.name,
        threshold: 5,
      });
    }

    dockerHelper.runSlowQueries([mysql, postgresql]);

    for (const { expected, filter, name } of rules.filter(({ expected }) => expected.length)) {
      await pmmTest.step(
        `${filter.label} ${filter.type} ${filter.regexp} fires for ${expected.join(', ')}`,
        async () => {
          await expect
            .poll(() => api.alertingApi.getFiringServices(name), { timeout: qanFiringTimeout })
            .toEqual(expected);
        },
      );
    }

    await pmmTest.step(
      'With both slow queries in, every filter still fires for the same services',
      async () => {
        for (const { expected, name } of rules) {
          expect(await api.alertingApi.getFiringServices(name), name).toEqual(expected);
        }
      },
    );

    await pmmTest.step(
      'A MISMATCH on a label the query never returns fires for nothing, without errors',
      async () => {
        const rule = await api.alertingApi.getRule('qan-missing-label-mismatch');

        expect(rule?.state).toBe('inactive');
        expect(rule?.alerts?.map(({ state }) => state)).toEqual(['Normal (NoData)']);
      },
    );

    await pmmTest.step('Grafana wraps the rule SQL in the filter', async () => {
      for (const [name, where] of [
        [
          'qan-service-match',
          `WHERE match(arrayStringConcat([COLUMNS('^service_name$')]), '^(?:(?:${mysql.service_name})|)$')`,
        ],
        [
          'qan-environment-mismatch',
          `WHERE NOT match(arrayStringConcat([COLUMNS('^environment$')]), '^(?:${mysql.environment})$')`,
        ],
      ]) {
        const { data } = await api.alertingApi.getProvisionedRule(await api.alertingApi.getRuleUid(name));
        const sql = data.find(({ refId }) => refId === 'A')?.model.rawSql;

        expect(sql).toMatch(/^SELECT \* FROM \(/);
        expect(sql?.endsWith(where), `${name} SQL ends with the filter`).toBe(true);
      }
    });
  },
);

pmmTest(
  'PMM-Txxxx - Verify a rule with an invalid filter label or regular expression is refused @fb-alerting',
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
      await alertingPage.builders.filterLabel(0).fill('service_name');
      await alertingPage.builders.filterRegex(0).fill('(');
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
  'PMM-Txxxx - Verify a node threshold override applies to a QAN slow queries rule only on that node @fb-alerting',
  async ({ alertThresholdsPage, api, dockerHelper, nodesPage, page }) => {
    const ruleName = 'qan-slow-15';
    const mysql = await api.inventoryApi.getQanService(mysqlQan);
    const postgresql = await api.inventoryApi.getQanService(postgresqlQan);

    expect(mysql.node_id, 'the services must run on different nodes').not.toBe(postgresql.node_id);
    await api.alertingApi.createFastRuleFromTemplate({
      folderUid,
      name: ruleName,
      templateName: qanTemplate.name,
      threshold: 15,
    });

    await pmmTest.step('Override the threshold to 5 on the MySQL node', async () => {
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(mysql.node_name);
      await alertThresholdsPage.verifyDefault(ruleName, 15, 's');
      await alertThresholdsPage.saveOverride(ruleName, '5');
      await nodesPage.openAlertThresholds(mysql.node_name);
      await alertThresholdsPage.verifyOverride(ruleName, '5');
      await alertThresholdsPage.buttons.cancel.click();
    });

    dockerHelper.runSlowQueries([mysql, postgresql]);

    await pmmTest.step('A 12s query fires on the MySQL node only', async () => {
      await expect
        .poll(() => api.alertingApi.getFiringServices(ruleName), { timeout: qanFiringTimeout })
        .toEqual([mysql.service_name]);

      const alerts = await api.alertingApi.getRuleAlerts(ruleName, 'service_name', mysql.service_name, {
        activeOnly: true,
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].annotations?.description).toMatch(/took 12\.\d\ds, more than 5s\./);
    });

    await pmmTest.step('PostgreSQL keeps the default of 15', async () => {
      // Every instance carries the measured time, firing or not, so this tells when the 12s query reached the rule.
      await expect
        .poll(
          async () =>
            (await api.alertingApi.getRuleAlerts(ruleName, 'service_name', postgresql.service_name)).some(
              ({ annotations }) => /took 12\.\d\ds, more than 15s/.test(annotations?.description ?? ''),
            ),
          { timeout: qanFiringTimeout },
        )
        .toBe(true);
      expect(
        await api.alertingApi.getRuleAlerts(ruleName, 'service_name', postgresql.service_name, {
          activeOnly: true,
        }),
        'PostgreSQL is neither pending nor firing',
      ).toEqual([]);
    });

    await pmmTest.step('Resetting the override resolves the MySQL alert', async () => {
      // A fresh slow query keeps a 12s run in the window, so the alert can only resolve through the default of 15.
      dockerHelper.runSlowQueries([mysql]);
      await page.goto(nodesPage.url);
      await nodesPage.openAlertThresholds(mysql.node_name);
      await alertThresholdsPage.resetOverride(ruleName);
      await nodesPage.openAlertThresholds(mysql.node_name);
      await alertThresholdsPage.verifyOverride(ruleName, '15');
      await expect
        .poll(
          async () =>
            (await api.alertingApi.getRuleAlerts(ruleName, 'service_name', mysql.service_name)).map(
              ({ annotations, state }) =>
                `${state.split(' ')[0]}: ${annotations?.description?.split('\n')[0]}`,
            ),
          { timeout: qanFiringTimeout },
        )
        .toEqual([expect.stringMatching(/^Normal: .*took 12\.\d\ds, more than 15s\.$/)]);
    });
  },
);

pmmTest(
  'PMM-Txxxx - Verify a user template with a ClickHouse query can be added and its rules fire @fb-alerting',
  async ({ alertingPage, api }) => {
    const mysql = await api.inventoryApi.getQanService(mysqlQan);
    const postgresql = await api.inventoryApi.getQanService(postgresqlQan);

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
        const rules: { filters?: AlertRuleFilter[]; name: string }[] = [
          { name: 'qan-count' },
          {
            filters: [{ label: 'region', regexp: 'eu', type: 'FILTER_TYPE_MATCH' }],
            name: 'qan-count-region',
          },
        ];

        for (const { filters, name } of rules) {
          await api.alertingApi.createFastRuleFromTemplate({
            filters,
            folderUid,
            name,
            templateName: userTemplate.name,
            threshold: 0,
          });
        }

        for (const { name } of rules) {
          await expect
            .poll(() => api.alertingApi.getFiringServices(name), { timeout: qanFiringTimeout })
            .toEqual(expect.arrayContaining([mysql.service_name, postgresql.service_name]));

          const alerts = await api.alertingApi.getRuleAlerts(name, 'service_name', mysql.service_name, {
            activeOnly: true,
          });

          expect(alerts).toHaveLength(1);
          expect(alerts[0].annotations?.description).toMatch(
            new RegExp(`^${mysql.service_name} ran \\S+ queries\\.$`),
          );
        }

        const { data } = await api.alertingApi.getProvisionedRule(
          await api.alertingApi.getRuleUid('qan-count-region'),
        );

        expect(data.find(({ refId }) => refId === 'A')?.model.rawSql).toContain("COLUMNS('^region$')");
      },
    );
  },
);

pmmTest(
  'PMM-Txxxx - Verify user templates that misuse a ClickHouse query are refused with a clear message @fb-alerting',
  async ({ alertingPage, page }) => {
    await alertingPage.openTemplates();

    for (const [index, { change, edit, message }] of rejectedClickHouseTemplates.entries()) {
      await pmmTest.step(`A template with ${change} is refused`, async () => {
        await alertingPage.verifyTemplateRefused(refusedTemplate(index, edit), message);
      });
    }

    await pmmTest.step('None of the refused templates is listed', async () => {
      await page.reload();
      await expect(alertingPage.builders.templateRow(qanTemplate.summary)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });

      for (const index of rejectedClickHouseTemplates.keys()) {
        await expect(alertingPage.builders.templateRow(rejectedName(index))).toHaveCount(0);
      }
    });
  },
);

pmmTest(
  'PMM-Txxxx - Verify an edit that breaks a ClickHouse user template is refused and the template is kept @fb-alerting',
  async ({ alertingPage, api }) => {
    await api.alertingApi.uploadTemplate(userTemplate.yaml);
    await alertingPage.openTemplates();
    await alertingPage.builders.editTemplate(userTemplate.summary).click();
    await expect(alertingPage.inputs.template).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.inputs.template.fill(unsupportedReducer.edit(userTemplate.yaml));
    await alertingPage.buttons.saveTemplate.click();
    await expect(alertingPage.messages.popUp).toContainText('Failed to parse rule template');

    const template = await api.alertingApi.getTemplate(userTemplate.name);

    expect(template.expressions?.find(({ ref_id }) => ref_id === 'B')?.reducer).toBe('sum');
  },
);
