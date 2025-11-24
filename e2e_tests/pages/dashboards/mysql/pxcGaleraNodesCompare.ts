import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class PXCGaleraNodesCompare {
  constructor() {}

  url = 'graph/d/pxc-nodes-compare/pxc-galera-nodes-compare';
  metrics: (serviceName: string) => GrafanaPanel[] = (serviceName: string): GrafanaPanel[] => [
    { name: `${serviceName} - Ready to Accept Queries`, type: 'stat' },
    { name: `${serviceName} - Local State`, type: 'stat' },
    { name: `${serviceName} - Desync Mode`, type: 'stat' },
    { name: `${serviceName} - Cluster Status`, type: 'stat' },
    { name: `${serviceName} - gcache Size`, type: 'stat' },
    { name: `${serviceName} - FC (normal traffic)`, type: 'stat' },
    { name: serviceName, type: 'timeSeries' },
    { name: serviceName, type: 'timeSeries' },
    { name: serviceName, type: 'timeSeries' },
    { name: serviceName, type: 'timeSeries' },
    { name: serviceName, type: 'timeSeries' },
    { name: serviceName, type: 'timeSeries' },
    { name: serviceName, type: 'timeSeries' },
    { name: serviceName, type: 'timeSeries' },
    { name: serviceName, type: 'timeSeries' },
    { name: serviceName, type: 'timeSeries' },
    { name: `my_wsrep_cluster - Galera Cluster Size`, type: 'timeSeries' },
  ];

  noDataMetrics: string[] = [];
  metricsWithData = (serviceName: string) =>
    this.metrics(serviceName).filter((metric) => !this.noDataMetrics.includes(metric.name));
}
