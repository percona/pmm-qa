import { Page, APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '../helpers/grafana.helper';
import { GetServices, GetService } from '../intefaces/getServices';

export default class InventoryApi {
  constructor(
    private readonly page: Page,
    private request: APIRequestContext,
  ) {}

  getServiceDetailsByPartialName = async (
    partialServiceName: string,
  ): Promise<GetService> => {
    const services = await this.getServices();

    const service = services.services.find((service: GetService) =>
      service.service_name.includes(partialServiceName),
    );

    if (!service) {
      throw new Error(`Service with name ${partialServiceName} is not present`);
    }

    return service;
  };

  getServices = async (): Promise<GetServices> => {
    const authToken = GrafanaHelper.getToken();
    const services = await this.request.get('/v1/management/services', {
      headers: {
        Authorization: `Basic ${authToken}`,
      },
    });

    expect(
      services.status(),
      `Get services API call returned status code: ${services.status()} with error message: ${services.statusText()}`,
    ).toEqual(200);

    return <GetServices>await services.json();
  };
}
