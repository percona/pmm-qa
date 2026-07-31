import { APIRequestContext } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';

type Headers = Record<string, string>;

export interface AlertTemplateBody {
  yaml: string;
}

export interface CreateAlertRuleBody {
  name: string;
  folder_uid: string;
  template_name: string;
  group: string;
  interval: string;
  for: string;
  params: object[];
  filters: object[];
}

export interface AlertFolderBody {
  id: number;
  uid: string;
  title: string;
  managedBy: string;
}

export default class AlertingApi {
  constructor(private request: APIRequestContext) {}

  createRule = async (headers: Headers, data: CreateAlertRuleBody) =>
    this.request.post(apiEndpoints.alerting.rules, { data, headers });

  createTemplate = async (headers: Headers, yamlBody: AlertTemplateBody) =>
    this.request.post(apiEndpoints.alerting.templates, { data: yamlBody, headers });

  deleteTemplate = async (headers: Headers, templateName: string) =>
    this.request.delete(`${apiEndpoints.alerting.templates}/${templateName}`, { headers });

  getAlerts = async (headers?: Headers): Promise<AlertFolderBody[]> => {
    const authHeaders = headers == null ? GrafanaHelper.getAuthHeader() : headers;
    const response = await this.request.get(apiEndpoints.alerting.listAlerts, { headers: authHeaders });

    return (await response.json()).data;
  };

  getFolderByName = async (folderName: string, headers?: Headers): Promise<AlertFolderBody> => {
    const response: AlertFolderBody[] = await this.getFolders(headers);
    const folder = response.find((folder) => folder.title === folderName);

    if (!folder) {
      throw new Error(`No such folder with name ${folderName}`);
    }

    return folder;
  };

  getFolders = async (headers?: Headers): Promise<AlertFolderBody[]> => {
    const authHeaders = headers == null ? GrafanaHelper.getAuthHeader() : headers;
    const response = await this.request.get(apiEndpoints.alerting.folders, { headers: authHeaders });

    return response.json();
  };

  listTemplates = async (headers: Headers) => this.request.get(apiEndpoints.alerting.templates, { headers });

  updateTemplate = async (headers: Headers, templateName: string, yamlBody: AlertTemplateBody) =>
    this.request.put(`${apiEndpoints.alerting.templates}/${templateName}`, {
      data: { name: templateName, ...yamlBody },
      headers,
    });
}
