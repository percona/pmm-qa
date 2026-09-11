import { APIRequestContext, expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { AlertRule, AlertRulesResponse, TemplatedAlertRule } from '@interfaces/alerting';

type Headers = Record<string, string>;

export interface AlertTemplateBody {
  yaml: string;
}

export default class AlertingApi {
  constructor(private request: APIRequestContext) {}

  createRule = async (headers: Headers, body: Record<string, unknown>) =>
    this.request.post(apiEndpoints.alerting.rules, { data: body, headers });

  createRuleFromTemplate = async (rule: TemplatedAlertRule): Promise<void> => {
    const response = await this.createRule(GrafanaHelper.getAuthHeader(), {
      folder_uid: rule.folderUid,
      for: rule.pendingPeriod,
      group: rule.group,
      name: rule.name,
      params: [{ float: rule.threshold, name: 'threshold', type: 'PARAM_TYPE_FLOAT' }],
      severity: 'SEVERITY_WARNING',
      template_name: rule.templateName,
    });

    expect(response.status(), await response.text()).toEqual(200);
  };

  createTemplate = async (headers: Headers, yamlBody: AlertTemplateBody) =>
    this.request.post(apiEndpoints.alerting.templates, { data: yamlBody, headers });

  deleteTemplate = async (headers: Headers, templateName: string) =>
    this.request.delete(`${apiEndpoints.alerting.templates}/${templateName}`, { headers });

  getRule = async (name: string): Promise<AlertRule | undefined> => {
    const response = await this.request.get(apiEndpoints.grafana.prometheusRules, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return ((await response.json()) as AlertRulesResponse).data.groups
      .flatMap((group) => group.rules)
      .find((rule) => rule.name === name);
  };

  listTemplates = async (headers: Headers) => this.request.get(apiEndpoints.alerting.templates, { headers });

  updateTemplate = async (headers: Headers, templateName: string, yamlBody: AlertTemplateBody) =>
    this.request.put(`${apiEndpoints.alerting.templates}/${templateName}`, {
      data: { name: templateName, ...yamlBody },
      headers,
    });
}
