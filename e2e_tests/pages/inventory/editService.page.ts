import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect, Response } from '@playwright/test';

export interface ServiceLabels {
  cluster: string;
  environment: string;
  replicationSet: string;
}

export default class EditServicePage extends BasePage {
  readonly url = 'pmm-ui/inventory/services';
  builders = {
    successMessage: (serviceName: string) =>
      this.page.getByText(`Service “${serviceName}” was changed. It is now ready to continue monitoring.`),
  };
  buttons = {
    confirmChanges: this.page.getByTestId('confirm-changes-modal-confirm'),
    saveChanges: this.page.getByTestId('edit-service-submit'),
  };
  elements = {
    clusterChangedWarning: this.page.getByTestId('cluster-changed-warning'),
    confirmModal: this.page.getByTestId('confirm-changes-modal'),
    form: this.page.getByTestId('edit-service-form'),
    settingsChangedInfo: this.page.getByTestId('settings-changed-info'),
  };
  inputs = {
    cluster: this.page.getByTestId('text-input-cluster'),
    environment: this.page.getByTestId('text-input-environment'),
    replicationSet: this.page.getByTestId('text-input-replication-set'),
  };
  messages = {};

  editCluster = async (cluster: string) => {
    await this.inputs.cluster.fill(cluster);
  };

  editEnvironment = async (environment: string) => {
    await this.inputs.environment.fill(environment);
  };

  editReplicationSet = async (replicationSet: string) => {
    await this.inputs.replicationSet.fill(replicationSet);
  };

  open = async (serviceId: string) => {
    await this.page.goto(`${this.url}/${serviceId}/edit`);
    await expect(this.elements.form).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

  saveChanges = async (serviceId: string, clusterChanged: boolean): Promise<Response> => {
    await this.buttons.saveChanges.click();
    await expect(this.elements.confirmModal).toBeVisible();
    await expect(this.elements.clusterChangedWarning).toBeVisible({ visible: clusterChanged });
    await expect(this.elements.settingsChangedInfo).toBeHidden();

    const [response] = await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.url().includes(`/v1/management/services/${serviceId}`) &&
          response.request().method() === 'PUT',
      ),
      this.buttons.confirmChanges.click(),
    ]);

    return response;
  };

  verifyLabels = async (labels: ServiceLabels) => {
    await expect(this.inputs.environment).toHaveValue(labels.environment);
    await expect(this.inputs.cluster).toHaveValue(labels.cluster);
    await expect(this.inputs.replicationSet).toHaveValue(labels.replicationSet);
  };
}
