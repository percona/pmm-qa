import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  let rdsExporterId: string;
  let rdsExporterPort: string;
  const serverUrlFlag = `--server-url=http://admin:Heslo123@127.0.0.1:8080`;

  pmmTest('T10000 - Add rds @rds-integration', async ({ api, cliHelper }) => {
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
        node_name: process.env.PMM_QA_MYSQL_RDS_8_4_ID,
        password: process.env.PMM_QA_MYSQL_RDS_8_4_PASSWORD,
        pmm_agent_id: 'pmm-server',
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
          `docker exec pmm-server pmm-admin list ${serverUrlFlag} | grep rds_exporter | awk -F' ' '{print $2}'`,
        )
        .stdout.trim();

      expect(status).toEqual('Running');
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });
  });

  pmmTest('T1001 - Enable disable rds exporter @rds-integration', async ({ api, cliHelper, page }) => {
    console.log(`Server url flag is: ${serverUrlFlag}`);
    console.log(cliHelper.execSilent(`docker exec pmm-server pmm-admin list ${serverUrlFlag}`).stdout);

    rdsExporterId = cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin list ${serverUrlFlag} | grep rds_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();

    cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin inventory change agent rds-exporter ${rdsExporterId} ${serverUrlFlag} --enable=false`,
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
        `docker exec pmm-server pmm-admin inventory change agent rds-exporter ${rdsExporterId} ${serverUrlFlag} --enable=true`,
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
    console.log(`Server url flag is: ${serverUrlFlag}`);
    console.log(cliHelper.execSilent(`docker exec pmm-server pmm-admin list ${serverUrlFlag}`).stdout);

    rdsExporterId = cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin list ${serverUrlFlag} | grep rds_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();

    rdsExporterPort = cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin list ${serverUrlFlag} | grep rds_exporter | awk -F' ' '{print $5}'`,
      )
      .stdout.trim();

    cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin inventory change agent rds-exporter ${rdsExporterId} ${serverUrlFlag} --disable-basic-metrics`,
      )
      .assertSuccess();

    await expect(async () => {
      const countOfBasicMetrics = cliHelper
        .execSilent(
          `docker exec pmm-server curl -s -u 'pmm:${rdsExporterId}' http://127.0.0.1:${rdsExporterPort}/basic | grep -c '^aws_rds_'`,
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
        `docker exec pmm-server pmm-admin inventory change agent rds-exporter ${rdsExporterId} ${serverUrlFlag} --disable-basic-metrics=false`,
      )
      .assertSuccess();

    await expect(async () => {
      const countOfBasicMetrics = cliHelper
        .execSilent(
          `docker exec pmm-server curl -s -u 'pmm:${rdsExporterId}' http://127.0.0.1:${rdsExporterPort}/basic | grep -c '^aws_rds_'`,
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
    console.log(`Server url flag is: ${serverUrlFlag}`);
    console.log(cliHelper.execSilent(`docker exec pmm-server pmm-admin list ${serverUrlFlag}`).stdout);

    rdsExporterId = cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin list ${serverUrlFlag} | grep rds_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();

    rdsExporterPort = cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin list ${serverUrlFlag} | grep rds_exporter | awk -F' ' '{print $5}'`,
      )
      .stdout.trim();

    cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin inventory change agent rds-exporter ${rdsExporterId} ${serverUrlFlag} --disable-enhanced-metrics`,
      )
      .assertSuccess();

    await expect(async () => {
      const countOfBasicMetrics = cliHelper
        .execSilent(
          `docker exec pmm-server curl -s -u 'pmm:${rdsExporterId}' http://127.0.0.1:${rdsExporterPort}/enhanced | grep -c '^rdsosmetrics_'`,
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

    console.log(
      `docker exec pmm-server pmm-admin inventory change agent rds-exporter ${rdsExporterId} ${serverUrlFlag} --disable-enhanced-metrics=false`,
    );

    cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin inventory change agent rds-exporter ${rdsExporterId} ${serverUrlFlag} --disable-enhanced-metrics=false`,
      )
      .assertSuccess();

    await expect(async () => {
      const countOfBasicMetrics = cliHelper
        .execSilent(
          `docker exec pmm-server curl -s -u 'pmm:${rdsExporterId}' http://127.0.0.1:${rdsExporterPort}/enhanced | grep -c '^rdsosmetrics_'`,
        )
        .stdout.trim();

      console.log(
        `docker exec pmm-server curl -s -u 'pmm:${rdsExporterId}' http://127.0.0.1:${rdsExporterPort}/enhanced | grep -c '^rdsosmetrics_'`,
      );

      expect(
        Number.parseInt(countOfBasicMetrics),
        `Actual count of enhanced metrics is: ${countOfBasicMetrics} should be greater than: 0`,
      ).toBeGreaterThan(0);
    }).toPass({
      intervals: [Timeouts.TWO_SECONDS],
      timeout: Timeouts.ONE_MINUTE,
    });
  });
});
