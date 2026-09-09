import { APIRequestContext, APIResponse } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';

export default class AnnotationApi {
  constructor(private request: APIRequestContext) {}

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
