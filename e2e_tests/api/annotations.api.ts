import { APIRequestContext, expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';

interface SetAnnotation {
  nodeName: string;
  serviceNames: string[];
  tags: string[];
  text: string;
}

export default class AnnotationsApi {
  constructor(private request: APIRequestContext) {}

  setAnnotation = async ({ nodeName, serviceNames, tags, text }: SetAnnotation) => {
    const response = await this.request.post(apiEndpoints.management.annotations, {
      data: { node_name: nodeName, service_names: serviceNames, tags, text },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `Failed to add annotation "${text}". Response: ${await response.text()}`,
    ).toEqual(200);

    return response;
  };
}
