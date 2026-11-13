import pmmTest from '@fixtures/pmmTest';
import { offeredQuerySources, serviceQanSources } from '@helpers/serviceQan.helper';
import {
  noRdsCredentials,
  RdsAuthMode,
  rdsCloudWatchMetric,
  rdsCredentialsState,
  rdsInstanceId,
} from '@helpers/serviceRds.helper';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const roleArn = 'arn:aws:iam::123456789012:role/PmmQaEditRds';

pmmTest.describe('Edit service | Amazon RDS', () => {
  // Every test adds the same RDS instance, which PMM lets only one node monitor at a time.
  pmmTest.describe.configure({ mode: 'default' });

  let serviceName: string;
  let service: GetService;
  let rdsExporterId: string;

  pmmTest.beforeEach(async ({ api, credentials, grafanaHelper }) => {
    await grafanaHelper.authorize();

    const { address, password, username } = credentials.rdsMysql84;

    serviceName = `pmm-edit-rds-${Date.now()}`;

    const { service_id } = (
      await api.managementApi.addRds({
        address,
        awsAccessKey: credentials.aws.accessKey,
        awsSecretKey: credentials.aws.secretKey,
        instanceId: rdsInstanceId(address),
        password,
        serviceName,
        username,
      })
    ).rds.mysql;

    service = await api.inventoryApi.getServiceById(service_id);
    rdsExporterId = (await api.managementApi.getRdsExporter(service.node_id)).agent_id;
  });

  // Removing an RDS service removes its node and RDS exporter too.
  pmmTest.afterEach(async ({ api }) => {
    const { services } = await api.inventoryApi.getServices();

    for (const { service_id } of services.filter((added) => added.service_name === serviceName)) {
      await api.managementApi.removeService(service_id);
    }
  });

  pmmTest(
    'PMM-15674 - Verify the edit page of an RDS service shows its access key and only the query source an RDS node allows @aws',
    async ({ credentials, editServicePage }) => {
      const offered = offeredQuerySources(serviceQanSources.ps);

      await editServicePage.open(service.service_id);
      await expect(editServicePage.elements.rdsCredentials).toContainText('Amazon RDS credentials');
      await editServicePage.verifyRdsCredentials(RdsAuthMode.accessKey, {
        awsAccessKey: credentials.aws.accessKey,
      });
      await editServicePage.verifyQuerySource('perfschema', offered);

      for (const querySource of offered) {
        await expect(
          editServicePage.builders.querySourceOption(querySource),
          `${querySource} enabled`,
        ).toBeEnabled({
          enabled: querySource !== 'slowlog',
        });
      }

      await expect(editServicePage.elements.querySourceRestriction).toHaveText(
        'On an Amazon RDS or Azure node, only the source that adding the service sets up is available.',
      );
    },
  );

  pmmTest(
    'PMM-15674 - Verify a label change of an RDS service keeps its AWS credentials @aws',
    async ({ api, credentials, editServicePage }) => {
      await editServicePage.open(service.service_id);
      await editServicePage.editEnvironment('pmm_edit_rds_check');

      const writes = editServicePage.recordApiWrites();

      await editServicePage.expectSaved(
        await editServicePage.saveChanges(service.service_id, { settingsChanged: false }),
      );
      expect(writes, 'untouched credentials are not sent').toEqual([
        `PUT /v1/management/services/${service.service_id}`,
      ]);
      expect(rdsCredentialsState(await api.managementApi.getRdsExporter(service.node_id))).toEqual({
        ...noRdsCredentials,
        awsAccessKey: credentials.aws.accessKey,
        isAwsSecretKeySet: true,
      });
    },
  );

  pmmTest(
    'PMM-15674 - Verify an RDS service switched to host credentials stores none, and an access key entered again is used @aws',
    async ({ api, credentials, editServicePage }) => {
      const cloudWatchMetric = `${rdsCloudWatchMetric}{node_id="${service.node_id}"}`;
      const { accessKey, secretKey } = credentials.aws;

      await pmmTest.step(
        'The RDS exporter reports CloudWatch metrics with the access key it was added with',
        () => api.prometheusApi.waitForNewSample(cloudWatchMetric, Timeouts.FIVE_MINUTES),
      );

      await editServicePage.open(service.service_id);
      await editServicePage.editRdsCredentials({ mode: RdsAuthMode.hostCredentials });
      await editServicePage.verifyRdsCredentials(RdsAuthMode.hostCredentials);

      const writes = editServicePage.recordApiWrites();

      await editServicePage.expectSaved(
        await editServicePage.saveCredentials(rdsExporterId, { dropsCredentials: true }),
      );
      await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();
      expect(writes, 'the RDS exporter is updated and the service is not').toEqual([
        `PUT /v1/inventory/agents/${rdsExporterId}`,
      ]);
      expect(rdsCredentialsState(await api.managementApi.getRdsExporter(service.node_id))).toEqual(
        noRdsCredentials,
      );

      await editServicePage.open(service.service_id);
      await editServicePage.verifyRdsCredentials(RdsAuthMode.hostCredentials);
      await editServicePage.editRdsCredentials({
        awsAccessKey: accessKey,
        awsSecretKey: secretKey,
        mode: RdsAuthMode.accessKey,
      });
      await editServicePage.expectSaved(await editServicePage.saveCredentials(rdsExporterId));
      await expect
        .poll(
          async () => {
            const exporter = await api.managementApi.getRdsExporter(service.node_id);

            return { ...rdsCredentialsState(exporter), status: exporter.status };
          },
          { message: 'the RDS exporter runs with the access key', timeout: Timeouts.ONE_MINUTE },
        )
        .toEqual({
          ...noRdsCredentials,
          awsAccessKey: accessKey,
          isAwsSecretKeySet: true,
          status: AgentStatus.running,
        });
      await api.prometheusApi.waitForNewSample(cloudWatchMetric, Timeouts.FIVE_MINUTES);

      await editServicePage.open(service.service_id);
      await editServicePage.verifyRdsCredentials(RdsAuthMode.accessKey, { awsAccessKey: accessKey });
    },
  );

  pmmTest(
    'PMM-15674 - Verify an RDS service switched to an IAM role stores the role and no access key @aws',
    async ({ api, editServicePage }) => {
      await editServicePage.open(service.service_id);
      await editServicePage.editRdsCredentials({ awsRoleArn: roleArn, mode: RdsAuthMode.iamRole });

      const writes = editServicePage.recordApiWrites();

      await editServicePage.expectSaved(await editServicePage.saveCredentials(rdsExporterId));
      expect(writes, 'the RDS exporter is updated and the service is not').toEqual([
        `PUT /v1/inventory/agents/${rdsExporterId}`,
      ]);
      expect(rdsCredentialsState(await api.managementApi.getRdsExporter(service.node_id))).toEqual({
        ...noRdsCredentials,
        awsRoleArn: roleArn,
      });

      await editServicePage.open(service.service_id);
      await editServicePage.verifyRdsCredentials(RdsAuthMode.iamRole, { awsRoleArn: roleArn });
    },
  );

  pmmTest(
    'PMM-15674 - Verify the form refuses AWS credentials an RDS service cannot use @aws',
    async ({ editServicePage }) => {
      await editServicePage.open(service.service_id);

      const writes = editServicePage.recordApiWrites();

      // Each step looks for a message the form is not showing yet.
      for (const { edit, message } of [
        {
          edit: { awsAccessKey: 'AKIAPMMQAEDITRDS0000', mode: RdsAuthMode.accessKey },
          message: 'Enter the secret key that goes with this access key',
        },
        { edit: { awsAccessKey: '', mode: RdsAuthMode.accessKey }, message: 'Required field' },
        {
          edit: { awsRoleArn: 'PmmQaEditRds', mode: RdsAuthMode.iamRole },
          message: 'Enter an IAM role ARN, for example arn:aws:iam::123456789012:role/RoleName',
        },
        { edit: { awsRoleArn: '', mode: RdsAuthMode.iamRole }, message: 'Required field' },
      ]) {
        await pmmTest.step(`${edit.mode}: ${message}`, async () => {
          await editServicePage.editRdsCredentials(edit);
          await editServicePage.buttons.saveChanges.click();
          await expect(
            editServicePage.elements.rdsCredentials.getByText(message, { exact: true }),
          ).toBeVisible();
          await expect(editServicePage.elements.confirmModal).toBeHidden();
        });
      }

      expect(writes, 'an invalid form sends nothing').toEqual([]);
    },
  );

  pmmTest(
    'PMM-15674 - Verify AWS credentials of an RDS service are saved first, and kept when the rest of the update is refused @aws',
    async ({ api, editServicePage }) => {
      const { username } = await api.inventoryApi.getServiceExporter(service.service_id, 'mysqld_exporter');

      await editServicePage.open(service.service_id);
      await editServicePage.editRdsCredentials({ mode: RdsAuthMode.hostCredentials });
      await editServicePage.editConnection({ password: 'wrong-password', username });

      const writes = editServicePage.recordApiWrites();
      const response = await editServicePage.saveChanges(service.service_id, {
        credentialsChanged: true,
        dropsCredentials: true,
      });

      await editServicePage.expectRefused(
        response,
        service.service_id,
        'the connection check refuses a wrong password',
      );
      await expect(
        editServicePage.builders.text(
          'AWS credentials were changed, the other settings were not. Review the error above and save them again.',
        ),
      ).toBeVisible();
      expect(writes, 'the credentials are saved before the service').toEqual([
        `PUT /v1/inventory/agents/${rdsExporterId}`,
        `PUT /v1/management/services/${service.service_id}`,
      ]);
      expect(rdsCredentialsState(await api.managementApi.getRdsExporter(service.node_id))).toEqual(
        noRdsCredentials,
      );
    },
  );
});
