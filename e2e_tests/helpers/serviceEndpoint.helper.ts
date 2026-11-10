import Api from '@api/api';
import { GetService, ServiceType } from '@interfaces/inventory';

type ServiceAgent = GetService['agents'][number];

export type MetricsScheme = 'http' | 'https';

// As the form shows the endpoint; the password field always opens empty.
export interface EndpointSettings {
  group?: string;
  listenPort: string;
  metricsPath: string;
  scheme: MetricsScheme;
  tlsSkipVerify: boolean;
  username: string;
}

// Each test registers a service of its own and removes it afterwards: the update API refuses an empty
// username or password, so basic auth, once set, cannot be taken off a framework service again.
export interface ServiceEndpoint {
  create: (container: string) => string;
  hasGroup: boolean;
  // The framework service whose container serves the endpoint and runs the pmm-agent that scrapes it.
  hostServiceRegex: string;
  name: string;
  serviceName: string;
  serviceType: ServiceType;
}

export const endpointExporterType = 'external-exporter';
export const basicAuth = { password: 'Pmm9Scrape_Test4', username: 'pmm_scrape' };

const haproxyServiceName = 'pmm_edit_haproxy_check';
const externalServiceName = 'pmm_edit_external_check';

export const serviceEndpoints: ServiceEndpoint[] = [
  {
    create: (container) =>
      `docker exec ${container} pmm-admin add haproxy --listen-port=42100 ${haproxyServiceName}`,
    hasGroup: false,
    hostServiceRegex: '^haproxy_pmm_service_',
    name: 'haproxy',
    serviceName: haproxyServiceName,
    serviceType: ServiceType.haproxy,
  },
  {
    // EXTERNAL cannot share a host with VALKEY in pmm-framework, so an External service scrapes HAProxy's metrics.
    create: (container) =>
      `docker exec ${container} pmm-admin add external --listen-port=42100 --group=pmm_edit_external --service-name=${externalServiceName}`,
    hasGroup: true,
    hostServiceRegex: '^haproxy_pmm_service_',
    name: 'external',
    serviceName: externalServiceName,
    serviceType: ServiceType.external,
  },
];

export const toEndpointSettings = (
  { external_group }: GetService,
  { listen_port, metrics_path, metrics_scheme, tls_skip_verify, username }: ServiceAgent,
  hasGroup: boolean,
): EndpointSettings => ({
  ...(hasGroup && { group: external_group ?? '' }),
  listenPort: listen_port ? String(listen_port) : '',
  metricsPath: metrics_path ?? '',
  scheme: (metrics_scheme || 'http') as MetricsScheme,
  tlsSkipVerify: !!tls_skip_verify,
  username: username ?? '',
});

export const readEndpoint = async (api: Api, serviceId: string, hasGroup: boolean) => {
  const service = await api.inventoryApi.getServiceById(serviceId);
  const exporter = await api.inventoryApi.getServiceExporter(serviceId, endpointExporterType);

  return { ...toEndpointSettings(service, exporter, hasGroup), passwordSet: !!exporter.is_password_set };
};
