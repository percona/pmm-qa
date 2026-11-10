import Api from '@api/api';
import { frameworkServices, OwnService } from '@helpers/frameworkServices.helper';
import { ServiceType } from '@interfaces/inventory';

export type MetricsScheme = 'http' | 'https';

export interface EndpointSettings {
  group?: string;
  listenPort: string;
  metricsPath: string;
  scheme: MetricsScheme;
  tlsSkipVerify: boolean;
  username: string;
}

export const endpointExporterType = frameworkServices.haproxy.exporterType;
export const basicAuth = { password: 'Pmm9Scrape_Test4', username: 'pmm_scrape' };

// Each test registers a service of its own on HAProxy's metrics and removes it afterwards: the update API
// refuses an empty username or password, so basic auth, once set, cannot be taken off a framework service.
// EXTERNAL cannot share a host with VALKEY in pmm-framework, so the External service scrapes HAProxy's metrics too.
export const serviceEndpoints: OwnService[] = [
  {
    register: (container) =>
      `docker exec ${container} pmm-admin add haproxy --listen-port=42100 pmm_edit_haproxy_check`,
    serviceName: 'pmm_edit_haproxy_check',
    serviceType: ServiceType.haproxy,
  },
  {
    register: (container) =>
      `docker exec ${container} pmm-admin add external --listen-port=42100 --group=pmm_edit_external --service-name=pmm_edit_external_check`,
    serviceName: 'pmm_edit_external_check',
    serviceType: ServiceType.external,
  },
];

export const readEndpoint = async (api: Api, serviceId: string) => {
  const { agents, external_group, service_type } = await api.inventoryApi.getServiceById(serviceId);
  const exporter = agents.find(({ agent_type }) => agent_type === endpointExporterType);

  if (!exporter) throw new Error(`${endpointExporterType} of service ${serviceId} is not present`);

  const { is_password_set, listen_port, metrics_path, metrics_scheme, tls_skip_verify, username } = exporter;

  return {
    ...(service_type === ServiceType.external && { group: external_group ?? '' }),
    listenPort: listen_port ? String(listen_port) : '',
    metricsPath: metrics_path ?? '',
    passwordSet: !!is_password_set,
    scheme: (metrics_scheme || 'http') as MetricsScheme,
    tlsSkipVerify: !!tls_skip_verify,
    username: username ?? '',
  };
};
