import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { ChangeAgentTypes as Types } from '@helpers/cli.helper';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  let containerName: string;
  let rdsExporterId: string;
  let rdsExporterPort: string;

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep pdpgsql`).stdout.trim();
  });

  pmmTest('T10000 - Add rds @rds-integration', async ({ api, cliHelper }) => {
    const externalNodeId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin status | grep "Node ID" | awk -F' ' '{print $4}'`)
      .stdout.trim();
    const externalPMMAgentId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin status | grep "Agent ID" | awk -F' ' '{print $4}'`)
      .stdout.trim();

    console.log(`External node name is: ${externalNodeId}`);
    console.log(`External PMM agent id is: ${externalPMMAgentId}`);

    await api.managementApi.addService({
      rds: {
        address: process.env.PMM_QA_MYSQL_RDS_8_4_HOST,
        aws_access_key: process.env.PMM_QA_AWS_ACCESS_KEY_ID,
        aws_secret_key: process.env.PMM_QA_AWS_ACCESS_KEY,
        az: 'us-east-2b',
        disable_comments_parsing: true,
        engine: 'DISCOVER_RDS_ENGINE_MYSQL',
        instance_id: process.env.PMM_QA_MYSQL_RDS_8_4_ID,
        isRDS: true,
        metrics_mode: 1,
        node_id: externalNodeId,
        node_name: process.env.PMM_QA_MYSQL_RDS_8_4_ID,
        password: process.env.PMM_QA_MYSQL_RDS_8_4_PASSWORD,
        pmm_agent_id: externalPMMAgentId,
        port: 42_001,
        qan_mysql_perfschema: true,
        rds_exporter: true,
        region: 'us-east-2',
        service_name: process.env.PMM_QA_MYSQL_RDS_8_4_ID,
        tablestatOptions: 'disabled',
        tablestats_group_table_limit: -1,
        username: process.env.PMM_QA_MYSQL_RDS_8_4_USER,
      },
    });

    await expect(async () => {
      const status = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep rds_exporter | awk -F' ' '{print $2}'`,
        )
        .stdout.trim();

      expect(status).toEqual('Running');
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });

    rdsExporterId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep rds_exporter | awk -F' ' '{print $4}'`)
      .stdout.trim();
    rdsExporterPort = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep rds_exporter | awk -F' ' '{print $5}'`)
      .stdout.trim();
  });

  pmmTest('T1001 - Enable disable rds exporter @rds-integration', async ({ api, cliHelper, page }) => {
    cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent rds-exporter ${rdsExporterId} --enable=false`,
      )
      .assertSuccess();

    await expect(async () => {
      const status = (await api.managementApi.getNodeDetails(process.env.PMM_QA_MYSQL_RDS_8_4_ID)).agents[0]
        .status;

      expect(status).toEqual('AGENT_STATUS_DONE');
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });

    // eslint-disable-next-line playwright/no-wait-for-timeout -- Temporary test
    await page.waitForTimeout(Timeouts.TEN_SECONDS);

    cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent rds-exporter ${rdsExporterId} --enable=true`,
      )
      .assertSuccess();

    await expect(async () => {
      const status = (await api.managementApi.getNodeDetails(process.env.PMM_QA_MYSQL_RDS_8_4_ID)).agents[0]
        .status;

      expect(status).toEqual('AGENT_STATUS_RUNNING');
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });
  });

  pmmTest('T1002 - enable disable basic metrics @rds-integration', async ({ cliHelper }) => {
    rdsExporterId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep rds_exporter | awk -F' ' '{print $4}'`)
      .stdout.trim();

    rdsExporterPort = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep rds_exporter | awk -F' ' '{print $5}'`)
      .stdout.trim();

    cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent rds-exporter ${rdsExporterId} --disable-basic-metrics`,
      )
      .assertSuccess();

    await expect(async () => {
      const countOfBasicMetrics = cliHelper
        .execSilent(
          `docker exec ${containerName} curl -s -u 'pmm:${rdsExporterId}' http://127.0.0.1:${rdsExporterPort}/basic | grep -c '^aws_rds_'`,
        )
        .stdout.trim();

      expect(
        countOfBasicMetrics,
        `Actual count of basic metrics is: ${countOfBasicMetrics} should equal: 0`,
      ).toEqual('0');
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });

    cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent rds-exporter ${rdsExporterId} --disable-basic-metrics=false`,
      )
      .assertSuccess();

    await expect(async () => {
      const countOfBasicMetrics = cliHelper
        .execSilent(
          `docker exec ${containerName} curl -s -u 'pmm:${rdsExporterId}' http://127.0.0.1:${rdsExporterPort}/basic | grep -c '^aws_rds_'`,
        )
        .stdout.trim();

      expect(
        Number.parseInt(countOfBasicMetrics),
        `Actual count of basic metrics is: ${countOfBasicMetrics} should be greater than: 0`,
      ).toBeGreaterThan(0);
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });
  });

  pmmTest('T1003 - enable disable enhanced metrics @rds-integration', async ({ cliHelper }) => {
    rdsExporterId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep rds_exporter | awk -F' ' '{print $4}'`)
      .stdout.trim();

    rdsExporterPort = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep rds_exporter | awk -F' ' '{print $5}'`)
      .stdout.trim();

    cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent rds-exporter ${rdsExporterId} --disable-enhanced-metrics`,
      )
      .assertSuccess();

    await expect(async () => {
      const countOfBasicMetrics = cliHelper
        .execSilent(
          `docker exec ${containerName} curl -s -u 'pmm:${rdsExporterId}' http://127.0.0.1:${rdsExporterPort}/enhanced | grep -c '^rdsosmetrics_'`,
        )
        .stdout.trim();

      expect(
        countOfBasicMetrics,
        `Actual count of enhanced metrics is: ${countOfBasicMetrics} should equal: 0`,
      ).toEqual('0');
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });

    cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent rds-exporter ${rdsExporterId} --disable-enhanced-metrics=false`,
      )
      .assertSuccess();

    await expect(async () => {
      const countOfBasicMetrics = cliHelper
        .execSilent(
          `docker exec ${containerName} curl -s -u 'pmm:${rdsExporterId}' http://127.0.0.1:${rdsExporterPort}/enhanced | grep -c '^rdsosmetrics_'`,
        )
        .stdout.trim();

      expect(
        Number.parseInt(countOfBasicMetrics),
        `Actual count of enhanced metrics is: ${countOfBasicMetrics} should be greater than: 0`,
      ).toBeGreaterThan(0);
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });
  });

  pmmTest(
    'PMM-T1004 - Verfiy Change agent custom labels @rds-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const customLabels = 'env=qa_testing_rds_exporter';
      const nodeId = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory list nodes | grep NODE_TYPE_REMOTE_RDS_NODE | awk -F' ' '{print $4}' `,
        )
        .stdout.trim();

      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent rds-exporter ${rdsExporterId} --custom-labels=${customLabels}`,
        )
        .assertSuccess();

      await grafanaHelper.authorize();
      await page.goto(agentsPage.nodesUrl(nodeId));
      await agentsPage.showRowDetails(rdsExporterId);
      await expect(agentsPage.builders.property(customLabels)).toBeVisible();
    },
  );

  pmmTest('T1005 - enable disable push metrics @rds-integration', async ({ cliHelper, page }) => {
    console.log(
      cliHelper
        .execSilent(`docker exec ${containerName} pmm-admin list | grep rds_exporter`)
        .stdout.trim()
        .split(' '),
    );
    cliHelper.changeAgent(containerName, Types.rds, rdsExporterId, '--push-metrics');
    await expect(async () => {
      const pushMetricsList = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep rds_exporter | awk -F' ' '{print $3}'`,
        )
        .stdout.trim();

      expect(
        pushMetricsList,
        `Metrics mode for rds exporter should be push, but is: ${pushMetricsList}`,
      ).toEqual('push');
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });

    // eslint-disable-next-line playwright/no-wait-for-timeout -- Temporary test
    await page.waitForTimeout(Timeouts.TEN_SECONDS);

    await expect(async () => {
      const pushMetricsCount = cliHelper
        .execSilent(
          `docker exec pmm-server curl -s -G 'http://127.0.0.1:9090/prometheus/api/v1/query' --data-urlencode 'query=count_over_time(rdsosmetrics_General_numVCPUs[1m])' | jq '.data.result[0].value[1]''`,
        )
        .stdout.trim()
        .replaceAll('"', '');

      console.log(
        cliHelper.execSilent(
          `docker exec pmm-server curl -s -G 'http://127.0.0.1:9090/prometheus/api/v1/query' --data-urlencode 'query=count_over_time(rdsosmetrics_General_numVCPUs[10s])' | jq '.data.result[0]'`,
        ).stdout,
      );
      console.log(`Push metrics counts is: "${pushMetricsCount}"`);

      expect(
        Number.parseInt(pushMetricsCount, 10),
        `Count of metrics for push mode in the last ten seconds should be greater than 0 but is: ${pushMetricsCount}`,
      ).toBeGreaterThan(0);
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });

    cliHelper.changeAgent(containerName, Types.rds, rdsExporterId, '--push-metrics=false');

    // await expect(async () => {
    //   const pullMetricsList = cliHelper
    //     .execSilent(
    //       `docker exec pmm-server pmm-admin list ${serverUrlFlag} | grep rds_exporter | awk -F' ' '{print $3}'`,
    //     )
    //     .stdout.trim();
    //
    //   expect(
    //     pullMetricsList,
    //     `Metrics mode for rds exporter should be push, but is: ${pullMetricsList}`,
    //   ).toEqual('pull');
    // }).toPass({
    //   intervals: [Timeouts.TWO_SECONDS],
    //   timeout: Timeouts.ONE_MINUTE,
    // });
    //

    // await page.waitForTimeout(Timeouts.TEN_SECONDS);
    //
    // await expect(async () => {
    //   const pushMetricsCount = cliHelper
    //     .execSilent(
    //       `docker exec pmm-server curl -s -G 'http://127.0.0.1:9090/prometheus/api/v1/query' --data-urlencode 'query=count_over_time(rdsosmetrics_General_numVCPUs[10s])' | jq '.data.result[0].value[1]''`,
    //     )
    //     .stdout.trim()
    //     .replaceAll('"', '');
    //
    //   expect(
    //     Number.parseInt(pushMetricsCount, 10),
    //     `Count of metrics in the pull mode for last ten seconds should be greater than 0 but is: ${pushMetricsCount}`,
    //   ).toBeGreaterThan(0);
    // }).toPass({
    //   intervals: [Timeouts.TWO_SECONDS],
    //   timeout: Timeouts.ONE_MINUTE,
    // });
  });
});
