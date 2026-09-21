import { APIRequestContext } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';

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

  createRule = async (headers: Headers, data: CreateRuleBody) =>
    this.request.post(apiEndpoints.alerting.rules, { data, headers });

  createTemplate = async (headers: Headers, yamlBody: AlertTemplateBody) =>
    this.request.post(apiEndpoints.alerting.templates, { data: yamlBody, headers });

  deleteTemplate = async (headers: Headers, templateName: string) =>
    this.request.delete(`${apiEndpoints.alerting.templates}/${templateName}`, { headers });

  getFolderByName = async (folderName: string, headers?: Headers): Promise<FoldersResponseBody> => {
    const folders = await this.listFolders(headers);
    const folder = folders.find((folder) => folder.title === folderName);

    if (!folder) {
      throw new Error(`Folder with name: ${folderName} not found`);
    }

    return folder;
  };

  listFolders = async (headers?: Headers): Promise<FoldersResponseBody[]> => {
    const authHeaders = headers ? headers : GrafanaHelper.getAuthHeader();

    return await (await this.request.get(apiEndpoints.alerting.folders, { headers: authHeaders })).json();
  };

  listTemplates = async (headers: Headers) => this.request.get(apiEndpoints.alerting.templates, { headers });

  updateTemplate = async (headers: Headers, templateName: string, yamlBody: AlertTemplateBody) =>
    this.request.put(`${apiEndpoints.alerting.templates}/${templateName}`, {
      data: { name: templateName, ...yamlBody },
      headers,
    });
}
