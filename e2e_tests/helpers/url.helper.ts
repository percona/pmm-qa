import { buildUrl, IQueryParams } from 'build-url-ts';

interface BuildUrlParameters {
  database?: string;
  environment?: string;
  serviceName?: string;
  from?: string;
  to?: string;
}

export default class UrlHelper {
  constructor() {}

  buildUrlWithParameters(baseUrl: string, parameters: BuildUrlParameters) {
    const queryParams: IQueryParams = {};
    for (const key of Object.keys(parameters) as (keyof BuildUrlParameters)[]) {
      switch (key) {
        case 'database':
          queryParams['var-database'] = parameters[key];
          break;
        case 'environment':
          queryParams['var-environment'] = parameters[key];
          break;
        case 'serviceName':
          queryParams['var-service_name'] = parameters[key];
          break;
        case 'from':
          queryParams.from = parameters[key];
          break;
        case 'to':
          queryParams.to = parameters[key];
          break;
        default:
          throw new Error('Unsupported environment ' + key);
      }
    }

    return buildUrl(baseUrl, { queryParams });
  }
}
