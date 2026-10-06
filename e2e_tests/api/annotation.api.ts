import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';

export default class AnnotationApi {
  constructor(private request: APIRequestContext) {}

  getAnnotationsByTag = async (tag: string): Promise<{ tags: string[]; text: string }[]> => {
    const response = await this.request.get(`graph/api/annotations?tags=${tag}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return await response.json();
  };

  setAnnotation = async (
    text: string,
    tag: string,
    nodeName: string,
    serviceName: string,
  ): Promise<APIResponse> =>
    this.request.post(apiEndpoints.management.annotations, {
      data: { node_name: nodeName, service_names: [serviceName], tags: [tag], text },
      headers: GrafanaHelper.getAuthHeader(),
    });
}
