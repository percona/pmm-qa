import { APIRequestContext, expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import {
  AlertInstance,
  AlertRule,
  AlertRulesResponse,
  AlertSeverity,
  RulerRulesResponse,
  TemplatedAlertRule,
} from '@interfaces/alerting';
import { GrafanaFolder } from '@interfaces/grafana';

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
  params?: { name: string; type: string; float: number }[];
  group?: string;
  folder_uid?: string;
  filters?: {
    label: string;
    regexp: string;
    type: 'FILTER_TYPE_MATCH' | 'FILTER_TYPE_MISMATCH';
  }[];
}

export default class AlertingApi {
  constructor(private request: APIRequestContext) {}

  // Evaluates every 10s, so a firing alert shows up within a test's timeout.
  createFastRuleFromTemplate = async ({
    group = 'fast-rules',
    ...rule
  }: Omit<TemplatedAlertRule, 'group' | 'interval' | 'pendingPeriod'> & {
    group?: string;
  }): Promise<string> =>
    this.createRuleFromTemplate({ ...rule, group, interval: '10s', pendingPeriod: '10s' });

  createRule = async (headers: Headers, data: CreateRuleBody) =>
    this.request.post(apiEndpoints.alerting.rules, { data, headers });

  createRuleFromTemplate = async (rule: TemplatedAlertRule): Promise<string> => {
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

    return ((await response.json()) as { rule_id: string }).rule_id;
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

  getFolderByName = async (folderName: string, headers?: Headers): Promise<GrafanaFolder> => {
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

  getRulerGroups = async (): Promise<RulerRulesResponse[string]> => {
    const response = await this.request.get(apiEndpoints.grafana.ruler, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return Object.values((await response.json()) as RulerRulesResponse).flat();
  };

  listFolders = async (headers?: Headers): Promise<GrafanaFolder[]> => {
    const authHeaders = headers ? headers : GrafanaHelper.getAuthHeader();

    return await (await this.request.get(apiEndpoints.alerting.folders, { headers: authHeaders })).json();
  };

  listTemplates = async (headers: Headers) => this.request.get(apiEndpoints.alerting.templates, { headers });

  listThresholds = async (target: string): Promise<{ is_overridden: boolean; rule_id: string }[]> => {
    const response = await this.request.get(apiEndpoints.alerting.thresholds, {
      headers: GrafanaHelper.getAuthHeader(),
      params: { target },
    });

    expect(response.status(), await response.text()).toEqual(200);

    return (
      ((await response.json()) as { thresholds?: { is_overridden: boolean; rule_id: string }[] })
        .thresholds ?? []
    );
  };

  removeAllAlertRules = async (): Promise<void> => {
    for (const { name, rules } of await this.getRulerGroups()) {
      // Provisioned groups, like PMM's built-in self-monitoring rules, are read-only and cannot be deleted.
      if (rules.some(({ grafana_alert }) => grafana_alert.provenance)) continue;

      const folderUid = rules[0].grafana_alert.namespace_uid;
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

  uploadTemplate = async (yaml: string): Promise<void> => {
    const response = await this.createTemplate(GrafanaHelper.getAuthHeader(), { yaml });

    expect(response.status(), await response.text()).toEqual(200);
  };
}
