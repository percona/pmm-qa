import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  let rdsExporterId;

  pmmTest('T10000 - Add rds @rds-integration', async ({ api }) => {
    const addService = await api.managementApi.addService({
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

    expect(addService).toBeDefined();
  });

  pmmTest('T1001 - Enable disable rds exporter @rds-integration', async ({ api, cliHelper }) => {
    console.log(
      cliHelper.execSilent(
        'docker exec pmm-server pmm-admin list --server-url=http://admin:admin@127.0.0.1:8080',
      ).stdout,
    );

    rdsExporterId = cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin list --server-url=http://admin:admin@127.0.0.1:8080 | grep rds_exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();

    cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin inventory change agent rds-exporter ${rdsExporterId} --server-url=http://admin:admin@127.0.0.1:8080 --enable=false`,
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

    cliHelper
      .execSilent(
        `docker exec pmm-server pmm-admin inventory change agent rds-exporter ${rdsExporterId} --server-url=http://admin:admin@127.0.0.1:8080 --enable=true`,
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
});
