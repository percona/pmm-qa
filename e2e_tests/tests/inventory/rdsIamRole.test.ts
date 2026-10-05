import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import Api from '@api/api';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus } from '@interfaces/inventory';

const unassumableRoleArn = 'arn:aws:iam::123456789012:role/PmmQaUnassumableRole';
let nodeId = '';

pmmTest.beforeEach(async ({ addInstancePage, grafanaHelper, page }) => {
  await grafanaHelper.authorize();
  await page.goto(addInstancePage.url);
  await addInstancePage.openRdsDiscovery();
});

pmmTest.afterEach(async ({ api }) => {
  if (nodeId) await api.inventoryApi.deleteNode(nodeId, true);

  nodeId = '';
});

pmmTest(
  'PMM-T2344 - Verify validation of the AWS IAM role ARN field on the Amazon RDS discovery form @fb-instances',
  async ({ addInstancePage }) => {
    await pmmTest.step('Verify the role ARN field, its placeholder and tooltip', async () => {
      await expect(addInstancePage.inputs.roleArn).toHaveAttribute(
        'placeholder',
        'arn:aws:iam::123456789012:role/PmmRdsMonitoring',
      );

      const secretKeyBox = await addInstancePage.elements.secretKeyFieldContainer.boundingBox();
      const roleArnBox = await addInstancePage.elements.roleArnFieldContainer.boundingBox();

      expect(roleArnBox?.y ?? 0, 'The role ARN field is below the access key and secret key').toBeGreaterThan(
        secretKeyBox?.y ?? Number.MAX_VALUE,
      );

      await addInstancePage.elements.roleArnTooltipIcon.hover();
      await expect(addInstancePage.elements.tooltip).toContainText(addInstancePage.texts.roleArnTooltip);
    });

    await pmmTest.step('Verify an invalid role ARN shows an error and blocks Discover', async () => {
      await addInstancePage.inputs.roleArn.fill('foo');
      await addInstancePage.inputs.roleArn.blur();
      await expect(addInstancePage.builders.fieldError('aws_role_arn')).toHaveText(
        addInstancePage.texts.invalidRoleArn,
      );

      await addInstancePage.verifyDiscoverIsBlocked();
    });

    for (const invalidArn of [
      'arn:aws:iam::12345:role/x',
      'arn:aws:iam::123456789012:user/x',
      'arn:aws:iam::123456789012:role/',
    ]) {
      await pmmTest.step(`Verify "${invalidArn}" is rejected`, async () => {
        await addInstancePage.inputs.roleArn.fill(invalidArn);
        await expect(addInstancePage.builders.fieldError('aws_role_arn')).toHaveText(
          addInstancePage.texts.invalidRoleArn,
        );
      });
    }

    await pmmTest.step('Verify a role ARN with a path is accepted', async () => {
      await addInstancePage.inputs.roleArn.fill('arn:aws:iam::123456789012:role/path/MyRole');
      await expect(addInstancePage.builders.fieldError('aws_role_arn')).toBeEmpty();
    });

    await pmmTest.step('Verify a role ARN together with an access key is rejected', async () => {
      await addInstancePage.inputs.accessKey.fill('AKIAIOSFODNN7EXAMPLE');
      await expect(addInstancePage.builders.fieldError('aws_access_key')).toHaveText(
        addInstancePage.texts.credentialsExclusive,
      );

      await addInstancePage.verifyDiscoverIsBlocked();
    });

    await pmmTest.step('Verify a role ARN together with only a secret key is rejected', async () => {
      await addInstancePage.inputs.accessKey.clear();
      await addInstancePage.inputs.secretKey.fill('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      await expect(addInstancePage.builders.fieldError('aws_secret_key')).toHaveText(
        addInstancePage.texts.credentialsExclusive,
      );
    });

    await pmmTest.step('Verify clearing the secret key removes the error', async () => {
      await addInstancePage.inputs.secretKey.clear();

      for (const field of ['aws_access_key', 'aws_secret_key', 'aws_role_arn']) {
        await expect(addInstancePage.builders.fieldError(field)).toBeEmpty();
      }
    });

    await pmmTest.step('Verify a role PMM cannot assume reports a clear error', async () => {
      const response = await addInstancePage.discoverRds({ roleArn: unassumableRoleArn });

      expect(response.status()).toEqual(400);
      await expect(addInstancePage.elements.alertError).toContainText(
        `Failed to assume role ${unassumableRoleArn}`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await expect(addInstancePage.inputs.roleArn).toBeEditable();
    });

    await pmmTest.step('Verify discovery with all fields empty sends no credentials', async () => {
      const response = await addInstancePage.discoverRds({});

      expect(response.request().postDataJSON()).toEqual({
        aws_access_key: '',
        aws_role_arn: '',
        aws_secret_key: '',
      });

      for (const field of ['aws_access_key', 'aws_secret_key', 'aws_role_arn']) {
        await expect(addInstancePage.builders.fieldError(field)).toBeEmpty();
      }
    });
  },
);

pmmTest(
  'PMM-T2343 - Verify adding Amazon RDS instance with AWS access key and secret key via UI @rds',
  async ({ addInstancePage, api, credentials, page, qanStoredMetrics, urlHelper }) => {
    const serviceName = `rds-mysql-keys-${Date.now()}`;

    await pmmTest.step('Discover RDS instances with an access key and secret key', async () => {
      const response = await addInstancePage.discoverRds({
        accessKey: credentials.aws.accessKey,
        secretKey: credentials.aws.secretKey,
      });

      expect(response.status(), `RDS discovery failed: ${await response.text()}`).toEqual(200);
      await expect(
        addInstancePage.builders.discoveredInstanceRow(credentials.rdsMysql84.instanceId),
      ).toBeVisible();
    });

    await pmmTest.step('Add the RDS MySQL instance for monitoring', async () => {
      await addInstancePage.addDiscoveredRdsMysql(credentials.rdsMysql84.instanceId, {
        password: credentials.rdsMysql84.password,
        serviceName,
        username: credentials.rdsMysql84.username,
      });

      nodeId = (await api.inventoryApi.getServiceDetailsByPartialName(serviceName)).node_id;
    });

    await pmmTest.step('Verify rds_exporter uses the access key and no role', async () => {
      await expect(async () => {
        const [rdsExporter] = await api.inventoryApi.getRdsExporters(nodeId);

        expect(rdsExporter.aws_access_key).toEqual(credentials.aws.accessKey);
        expect(rdsExporter.aws_role_arn ?? '').toEqual('');
        expect(rdsExporter.status).toEqual(AgentStatus.running);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });

    await pmmTest.step('Verify MySQL, CloudWatch and Enhanced Monitoring metrics are collected', async () => {
      await verifyRdsMetricsCollected(api, nodeId, serviceName);
    });

    await pmmTest.step('Verify QAN shows queries from the RDS instance', async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-15m', serviceName }),
      );
      await qanStoredMetrics.verifyQanStoredMetricsHaveData();
    });
  },
);

pmmTest(
  'PMM-T2342 - Verify adding Amazon RDS instance with only an IAM role ARN via UI @rds-iam-role',
  async ({ addInstancePage, api, credentials, page, qanStoredMetrics, urlHelper }) => {
    const roleArn = credentials.aws.rdsRoleArn;
    const serviceName = `rds-mysql-role-${Date.now()}`;

    expect(roleArn, 'PMM_QA_AWS_RDS_ROLE_ARN must name a role PMM Server can assume').not.toEqual('');

    await pmmTest.step('Discover RDS instances with only a role ARN', async () => {
      const response = await addInstancePage.discoverRds({ roleArn });

      expect(response.status(), `RDS discovery failed: ${await response.text()}`).toEqual(200);
      await expect(
        addInstancePage.builders.discoveredInstanceRow(credentials.rdsMysql84.instanceId),
      ).toBeVisible();
    });

    await pmmTest.step('Add the RDS MySQL instance for monitoring', async () => {
      await addInstancePage.addDiscoveredRdsMysql(credentials.rdsMysql84.instanceId, {
        password: credentials.rdsMysql84.password,
        serviceName,
        username: credentials.rdsMysql84.username,
      });

      nodeId = (await api.inventoryApi.getServiceDetailsByPartialName(serviceName)).node_id;
    });

    await pmmTest.step('Verify rds_exporter uses the role and stores no access key', async () => {
      await expect(async () => {
        const [rdsExporter] = await api.inventoryApi.getRdsExporters(nodeId);

        expect(rdsExporter.aws_role_arn).toEqual(roleArn);
        expect(rdsExporter.aws_access_key ?? '').toEqual('');
        expect(rdsExporter.status).toEqual(AgentStatus.running);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });

    await pmmTest.step('Verify MySQL, CloudWatch and Enhanced Monitoring metrics are collected', async () => {
      await verifyRdsMetricsCollected(api, nodeId, serviceName);
    });

    await pmmTest.step('Verify QAN shows queries from the RDS instance', async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-15m', serviceName }),
      );
      await qanStoredMetrics.verifyQanStoredMetricsHaveData();
    });
  },
);

// No Playwright page object covers the Amazon RDS dashboards yet, so the CloudWatch (basic) and
// Enhanced Monitoring series are checked in Prometheus directly.
const verifyRdsMetricsCollected = async (api: Api, rdsNodeId: string, serviceName: string) => {
  for (const query of [
    `mysql_up{service_name="${serviceName}"}`,
    `count({__name__=~"aws_rds_.+", node_id="${rdsNodeId}"})`,
    `count({__name__=~"rdsosmetrics_.+", node_id="${rdsNodeId}"})`,
  ]) {
    await expect(async () => {
      expect(await api.prometheusApi.instantQueryValue(query), query).toBeGreaterThan(0);
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TEN_MINUTES });
  }
};
