import { APIRequestContext } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';

type Headers = Record<string, string>;

export interface AlertTemplateBody {
  yaml: string;
}

export default class AlertingApi {
  constructor(private request: APIRequestContext) {}

  createRule = async (headers: Headers, templateName: string) =>
    this.request.post(apiEndpoints.alerting.rules, { data: { template_name: templateName }, headers });

  createTemplate = async (headers: Headers, yamlBody: AlertTemplateBody) =>
    this.request.post(apiEndpoints.alerting.templates, { data: yamlBody, headers });

  deleteTemplate = async (headers: Headers, templateName: string) =>
    this.request.delete(`${apiEndpoints.alerting.templates}/${templateName}`, { headers });

  listTemplates = async (headers: Headers) => this.request.get(apiEndpoints.alerting.templates, { headers });

  updateTemplate = async (headers: Headers, templateName: string, yamlBody: AlertTemplateBody) =>
    this.request.put(`${apiEndpoints.alerting.templates}/${templateName}`, {
      data: { name: templateName, ...yamlBody },
      headers,
    });
}
