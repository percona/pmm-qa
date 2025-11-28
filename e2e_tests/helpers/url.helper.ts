import { buildUrl, IQueryParams } from 'build-url-ts';

interface BuildUrlParameters {
  database?: string;
  schema?: string;
  environment?: string;
  serviceName?: string;
  refresh?: string;
  from?: string;
  to?: string;
  cluster?: string;
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
        case 'schema':
          queryParams['var-schema'] = parameters[key];
          break;
        case 'environment':
          queryParams['var-environment'] = parameters[key];
          break;
        case 'serviceName':
          queryParams['var-service_name'] = parameters[key];
          break;
        case 'refresh':
          queryParams['refresh'] = parameters[key];
          break;
        case 'from':
          queryParams.from = parameters[key];
          break;
        case 'to':
          queryParams.to = parameters[key];
          break;
        case 'cluster':
          queryParams['var-cluster'] = parameters[key];
          break;
        default:
          throw new Error('Unsupported environment ' + key);
      }
    }

    return buildUrl(baseUrl, { queryParams });
  }
}
