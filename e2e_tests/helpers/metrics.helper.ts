import { GrafanaPanel } from '@interfaces/grafanaPanel';
import { GetService } from '@interfaces/inventory';

/**
 * Replaces wildcard characters in panel names with actual service names.
 * This function iterates through a list of Grafana panels and a list of services.
 * If a panel's name contains a wildcard ('*'), it attempts to replace the wildcard
 * with a matching service name (either `node_name` or `service_name`) from the provided services list.
 *
 * @param metrics - An array of `GrafanaPanel` objects, some of which may have wildcard characters in their `name` property.
 * @param services - An array of `GetService` objects, containing service details including `node_name` and `service_name`.
 * @returns A new array of `GrafanaPanel` objects with wildcards replaced by actual service names where applicable.
 */
export const replaceWildcards = (metrics: GrafanaPanel[], services: GetService[]): GrafanaPanel[] => {
  const newMetrics: GrafanaPanel[] = [];
  const clonedMetrics = JSON.parse(JSON.stringify(metrics));

  for (const metric of clonedMetrics) {
    if (metric.name.includes('*')) {
      const prefix = metric.name.substring(0, metric.name.indexOf('*'));

      for (const service of services) {
        const nameToMatch = metric.name.includes('-node-') ? service.node_name : service.service_name;

        if (nameToMatch.startsWith(prefix)) {
          const newMetricName = metric.name.replace('*', nameToMatch.substring(prefix.length));

          if (!newMetrics.find((m) => m.name === newMetricName)) {
            newMetrics.push({ ...metric, name: newMetricName });
          }
        }
      }
    } else {
      newMetrics.push(metric);
    }
  }

  return newMetrics;
};
