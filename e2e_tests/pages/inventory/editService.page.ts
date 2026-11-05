import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect, Response } from '@playwright/test';

export interface ServiceLabels {
  cluster: string;
  customLabels: Record<string, string>;
  environment: string;
  replicationSet: string;
}

export interface ServiceConnection {
  agentPassword?: string;
  database?: string;
  password?: string;
  username: string;
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
    skipConnectionCheck: this.page.getByTestId('skip-connection-check'),
  };
  inputs = {
    agentPassword: this.page.getByTestId('text-input-agent-password'),
    cluster: this.page.getByTestId('text-input-cluster'),
    customLabels: this.page.getByTestId('text-input-custom-labels'),
    database: this.page.getByTestId('text-input-database'),
    environment: this.page.getByTestId('text-input-environment'),
    password: this.page.getByTestId('text-input-password'),
    replicationSet: this.page.getByTestId('text-input-replication-set'),
    username: this.page.getByTestId('text-input-username'),
  };
  messages = {};

  editCluster = async (cluster: string) => {
    await this.inputs.cluster.fill(cluster);
  };

  editConnection = async ({ agentPassword, database, password, username }: ServiceConnection) => {
    if (database !== undefined) await this.inputs.database.fill(database);

    await this.inputs.username.fill(username);

    if (password !== undefined) await this.inputs.password.fill(password);
    if (agentPassword !== undefined) await this.inputs.agentPassword.fill(agentPassword);
  };

  editCustomLabels = async (customLabels: Record<string, string>) => {
    await this.inputs.customLabels.fill(this.toCustomLabelsText(customLabels));
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

  saveChanges = async (
    serviceId: string,
    clusterChanged: boolean,
    settingsChanged = false,
  ): Promise<Response> => {
    await this.buttons.saveChanges.click();
    await expect(this.elements.confirmModal).toBeVisible();
    await expect(this.elements.clusterChangedWarning).toBeVisible({ visible: clusterChanged });
    await expect(this.elements.settingsChangedInfo).toBeVisible({ visible: settingsChanged });
    await expect(this.elements.skipConnectionCheck).toBeVisible({ visible: settingsChanged });

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

  // The form lists custom labels in the order the API returns them, which is sorted by name.
  toCustomLabelsText = (customLabels: Record<string, string>) =>
    Object.entries(customLabels)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name}:${value}`)
      .join('\n');

  // Passwords are never sent to the UI, so their fields always open empty.
  verifyConnection = async ({ database, username }: ServiceConnection) => {
    if (database !== undefined) await expect(this.inputs.database).toHaveValue(database);

    await expect(this.inputs.username).toHaveValue(username);

    for (const secret of [this.inputs.password, this.inputs.agentPassword]) {
      await expect(secret).toHaveAttribute('type', 'password');
      await expect(secret).toHaveValue('');
    }
  };

  verifyLabels = async (labels: ServiceLabels) => {
    await expect(this.inputs.environment).toHaveValue(labels.environment);
    await expect(this.inputs.cluster).toHaveValue(labels.cluster);
    await expect(this.inputs.replicationSet).toHaveValue(labels.replicationSet);
    await expect(this.inputs.customLabels).toHaveValue(this.toCustomLabelsText(labels.customLabels));
  };
}
