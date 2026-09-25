import { APIRequestContext, expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import {
  AlertInstance,
  AlertRule,
  AlertRulesResponse,
  AlertSeverity,
  TemplatedAlertRule,
} from '@interfaces/alerting';

type Headers = Record<string, string>;

export interface AlertTemplateBody {
  yaml: string;
}

export interface CreateRuleBody {
  for?: string;
  interval?: string;
  severity?: string;
  template_name: string;
  name?: string;
  params?: [{ name: string; type: string; float: number }];
  group?: string;
  folder_uid?: string;
  filters?: {
    label: string;
    regexp: string;
    type: 'FILTER_TYPE_MATCH' | 'FILTER_TYPE_MISMATCH';
  }[];
}

export interface FoldersResponseBody {
  id: number;
  uid: string;
  title: string;
  managedBy: string;
}

export default class AlertingApi {
  constructor(private request: APIRequestContext) {}

  createRule = async (headers: Headers, data: CreateRuleBody) => {
    const response = await this.request.post(apiEndpoints.alerting.rules, { data, headers });

    expect(response.status(), await response.text()).toEqual(200);

    return response;
  };

  createRuleFromTemplate = async (rule: TemplatedAlertRule): Promise<void> => {
    const response = await this.createRule(GrafanaHelper.getAuthHeader(), {
      filters: rule.serviceName
        ? [{ label: 'service_name', regexp: rule.serviceName, type: 'FILTER_TYPE_MATCH' }]
        : undefined,
      folder_uid: rule.folderUid,
      for: rule.pendingPeriod,
      group: rule.group,
      interval: rule.interval,
      name: rule.name,
      params: [{ float: rule.threshold, name: 'threshold', type: 'PARAM_TYPE_FLOAT' }],
      severity: rule.severity ?? AlertSeverity.Warning,
      template_name: rule.templateName,
    });

    expect(response.status(), await response.text()).toEqual(200);
  };

  createTemplate = async (headers: Headers, yamlBody: AlertTemplateBody) =>
    this.request.post(apiEndpoints.alerting.templates, { data: yamlBody, headers });

  deleteActiveSilences = async (): Promise<void> => {
    const response = await this.request.get(`${apiEndpoints.grafana.alertmanager}/silences`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    for (const { id, status } of (await response.json()) as { id: string; status: { state: string } }[]) {
      if (status.state !== 'active') continue;

      const deleted = await this.request.delete(`${apiEndpoints.grafana.alertmanager}/silence/${id}`, {
        headers: GrafanaHelper.getAuthHeader(),
      });

      expect(deleted.status(), await deleted.text()).toEqual(200);
    }
  };

  deleteTemplate = async (headers: Headers, templateName: string) =>
    this.request.delete(`${apiEndpoints.alerting.templates}/${templateName}`, { headers });

  getAlerts = async (): Promise<Pick<AlertInstance, 'labels'>[]> => {
    const response = await this.request.get(`${apiEndpoints.grafana.alertmanager}/alerts`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return (await response.json()) as Pick<AlertInstance, 'labels'>[];
  };

  getFolderByName = async (folderName: string, headers?: Headers): Promise<FoldersResponseBody> => {
    const folders = await this.listFolders(headers);
    const folder = folders.find((folder) => folder.title === folderName);

    if (!folder) {
      throw new Error(`Folder with name: ${folderName} not found`);
    }

    return folder;
  };

  getRule = async (name: string): Promise<AlertRule | undefined> =>
    (await this.getRuleGroups()).flatMap((group) => group.rules).find((rule) => rule.name === name);

  getRuleGroups = async (): Promise<AlertRulesResponse['data']['groups']> => {
    const response = await this.request.get(apiEndpoints.grafana.prometheusRules, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return ((await response.json()) as AlertRulesResponse).data.groups;
  };

  listFolders = async (headers?: Headers): Promise<FoldersResponseBody[]> => {
    const authHeaders = headers ? headers : GrafanaHelper.getAuthHeader();

    return await (await this.request.get(apiEndpoints.alerting.folders, { headers: authHeaders })).json();
  };

  listTemplates = async (headers: Headers) => this.request.get(apiEndpoints.alerting.templates, { headers });

  removeAllAlertRules = async (): Promise<void> => {
    for (const { folderUid, name } of await this.getRuleGroups()) {
      const response = await this.request.delete(`${apiEndpoints.grafana.ruler}/${folderUid}/${name}`, {
        headers: GrafanaHelper.getAuthHeader(),
        params: { subtype: 'cortex' },
      });

      expect(response.status(), await response.text()).toEqual(202);
    }
  };

  setEmptyReceiverIntegrations = async (integrations: Record<string, unknown>[]): Promise<void> => {
    const receivers = await this.request.get(apiEndpoints.grafana.receivers, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(receivers.status()).toEqual(200);

    const receiver = (
      (await receivers.json()) as {
        items: { metadata: { name: string; resourceVersion: string }; spec: { title: string } }[];
      }
    ).items.find((item) => item.spec.title === 'empty');

    if (!receiver) throw new Error('Receiver "empty" is not present');

    const { name, resourceVersion } = receiver.metadata;
    const response = await this.request.put(`${apiEndpoints.grafana.receivers}/${name}`, {
      data: {
        metadata: { name, resourceVersion },
        spec: { integrations, title: 'empty' },
      },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);
  };

  updateTemplate = async (headers: Headers, templateName: string, yamlBody: AlertTemplateBody) =>
    this.request.put(`${apiEndpoints.alerting.templates}/${templateName}`, {
      data: { name: templateName, ...yamlBody },
      headers,
    });
}
