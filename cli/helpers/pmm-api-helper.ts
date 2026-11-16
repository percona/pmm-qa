import { exec, shellQuote } from '@helpers/cli-helper';

/**
 * Call the PMM Server API through the pmm-server container
 *
 * @param   method          HTTP method
 * @param   path            API path, e.g. /v1/qan/metrics:getReport
 * @param   body            JSON request body
 * @param   adminPassword   PMM Server admin password
 */
export async function pmmServerApi(method: 'GET' | 'POST' | 'DELETE', path: string, body?: object, adminPassword = process.env.ADMIN_PASSWORD || 'admin') {
  const data = body ? ` -H 'Content-Type: application/json' -d '${JSON.stringify(body)}'` : '';
  const output = await exec(`docker exec pmm-server curl -sSf -u ${shellQuote(`admin:${adminPassword}`)} -X ${method}${data} http://127.0.0.1:8080${path}`);
  await output.assertSuccess();

  return JSON.parse(output.stdout) as Record<string, unknown>;
}

/**
 * Read an agent from the PMM Server inventory API through the pmm-server container
 *
 * @param   agentId         ID of the agent
 * @return  the agent's fields, whatever its type
 */
export async function getServerAgent(agentId: string): Promise<Record<string, unknown>> {
  const response = await pmmServerApi('GET', `/v1/inventory/agents/${agentId}`) as Record<string, Record<string, unknown> | undefined>;

  return Object.values(response)[0] ?? {};
}

/**
 * Run an instant PromQL query against PMM Server's VictoriaMetrics
 *
 * @param   query           PromQL query; must not contain single quotes
 * @param   adminPassword   PMM Server admin password
 * @param   time            evaluate the query at this time, default now
 * @return  label sets of the returned series
 */
export async function queryVictoriaMetrics(query: string, adminPassword = process.env.ADMIN_PASSWORD || 'admin', time?: Date): Promise<Record<string, string>[]> {
  const at = time ? ` --data-urlencode 'time=${time.toISOString()}'` : '';
  const output = await exec(`docker exec pmm-server curl -sSf -u ${shellQuote(`admin:${adminPassword}`)} -G http://127.0.0.1:8080/prometheus/api/v1/query --data-urlencode 'query=${query}'${at}`);
  await output.assertSuccess();
  const response = JSON.parse(output.stdout) as { data: { result: { metric: Record<string, string> }[] } };

  return response.data.result.map((series) => series.metric);
}

/**
 * Read a Service from the PMM Server inventory API through the pmm-server container
 *
 * @param   serviceId   ID of the Service
 * @return  the Service's fields, whatever its type
 */
export async function getServerService(serviceId: string): Promise<Record<string, unknown>> {
  const response = await pmmServerApi('GET', `/v1/inventory/services/${serviceId}`) as Record<string, Record<string, unknown> | undefined>;

  return Object.values(response)[0] ?? {};
}

/**
 * ID of a Service found by name in the PMM Server inventory API, including Services that run on PMM Server
 *
 * @param   serviceName   service name
 */
export async function getServerServiceId(serviceName: string): Promise<string> {
  const response = await pmmServerApi('GET', '/v1/inventory/services') as Record<string, { service_id: string, service_name: string }[]>;
  const service = Object.values(response).flat().find((item) => item.service_name === serviceName);
  if (!service) throw new Error(`Service ${serviceName} not found in the PMM Server inventory`);

  return service.service_id;
}

/**
 * Remove a Node, with its Services and Agents, found by name in the PMM Server inventory API
 *
 * @param   nodeName   node name
 */
export async function removeServerNode(nodeName: string) {
  const response = await pmmServerApi('GET', '/v1/inventory/nodes') as Record<string, { node_id: string, node_name: string }[]>;
  const node = Object.values(response).flat().find((item) => item.node_name === nodeName);
  if (node) await pmmServerApi('DELETE', `/v1/inventory/nodes/${node.node_id}?force=true`);
}

/**
 * Agents of a Service in the PMM Server inventory API
 *
 * @param   serviceId   ID of the Service
 * @return  sorted "<agent type>:<agent ID>" entries
 */
export async function getServerServiceAgents(serviceId: string): Promise<string[]> {
  const response = await pmmServerApi('GET', `/v1/inventory/agents?service_id=${serviceId}`) as Record<string, { agent_id: string }[]>;

  return Object.entries(response).flatMap(([type, agents]) => agents.map((agent) => `${type}:${agent.agent_id}`)).sort();
}

/**
 * Add a backup location on PMM Server's filesystem
 *
 * @param   name   location name
 * @param   path   directory of the backups
 * @return  ID of the location
 */
export async function addFilesystemBackupLocation(name: string, path: string): Promise<string> {
  const response = await pmmServerApi('POST', '/v1/backups/locations', { name, filesystem_config: { path } });

  return response.location_id as string;
}

/**
 * Remove a backup location, together with the scheduled backups that use it
 *
 * @param   locationId   ID of the location
 */
export async function removeBackupLocation(locationId: string) {
  await pmmServerApi('DELETE', `/v1/backups/locations/${locationId}?force=true`);
}

/**
 * Schedule a yearly logical backup of a Service that never runs during a test
 *
 * @param   serviceId     ID of the Service
 * @param   locationId    ID of the backup location
 * @param   name          name of the schedule
 * @return  ID of the scheduled backup
 */
export async function scheduleBackup(serviceId: string, locationId: string, name: string): Promise<string> {
  const response = await pmmServerApi('POST', '/v1/backups:schedule', {
    service_id: serviceId,
    location_id: locationId,
    cron_expression: '0 0 1 1 *',
    name,
    enabled: true,
    mode: 'BACKUP_MODE_SNAPSHOT',
    data_model: 'DATA_MODEL_LOGICAL',
    retries: 0,
  });

  return response.scheduled_backup_id as string;
}

/**
 * Remove a scheduled backup
 *
 * @param   scheduledBackupId   ID of the scheduled backup
 */
export async function removeScheduledBackup(scheduledBackupId: string) {
  await pmmServerApi('DELETE', `/v1/backups/${scheduledBackupId}`);
}

/**
 * IDs of the scheduled backups of a Service
 *
 * @param   serviceId   ID of the Service
 */
export async function getScheduledBackupIds(serviceId: string): Promise<string[]> {
  const response = await pmmServerApi('GET', '/v1/backups/scheduled') as { scheduled_backups?: { scheduled_backup_id: string, service_id: string }[] };

  return (response.scheduled_backups ?? []).filter((backup) => backup.service_id === serviceId).map((backup) => backup.scheduled_backup_id);
}

/**
 * QAN query classes of a service and database since a point in time
 *
 * @param   serviceName     service the queries ran on
 * @param   database        database the queries ran in
 * @param   from            start of the period
 * @param   databaseLabel   QAN label of the database: "database", or "schema" for MySQL
 */
export async function getQanQueries(serviceName: string, database: string, from: Date, databaseLabel = 'database'): Promise<{ queryId: string, fingerprint: string }[]> {
  const report = await pmmServerApi('POST', '/v1/qan/metrics:getReport', {
    period_start_from: from.toISOString(),
    period_start_to: new Date(Date.now() + 60_000).toISOString(),
    group_by: 'queryid',
    columns: ['num_queries'],
    limit: 100,
    labels: [{ key: 'service_name', value: [serviceName] }, { key: databaseLabel, value: [database] }],
  }) as { rows?: { dimension?: string, fingerprint?: string }[] };

  return (report.rows ?? [])
    .filter((row) => row.dimension)
    .map((row) => ({ queryId: row.dimension!, fingerprint: row.fingerprint ?? '' }));
}

/**
 * Latest QAN example of a query class on a service since a point in time.
 * A query ID is shared by every service that recorded the query, so another service's example
 * comes back unless the service is filtered.
 *
 * @param   serviceName     service the example was recorded for
 * @param   queryId         QAN query ID
 * @param   from            start of the period
 */
export async function getQanExample(serviceName: string, queryId: string, from: Date): Promise<{ example: string, isTruncated: boolean }> {
  const response = await pmmServerApi('POST', '/v1/qan/query:getExample', {
    period_start_from: from.toISOString(),
    period_start_to: new Date(Date.now() + 60_000).toISOString(),
    filter_by: queryId,
    group_by: 'queryid',
    labels: [{ key: 'service_name', value: [serviceName] }],
    limit: 1,
  }) as { query_examples?: { example?: string, is_truncated?: number }[] };
  const [example] = response.query_examples ?? [];

  return { example: example?.example ?? '', isTruncated: example?.is_truncated === 1 };
}
