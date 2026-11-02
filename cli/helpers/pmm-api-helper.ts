import { exec } from '@helpers/cli-helper';

/**
 * Call the PMM Server API through the pmm-server container
 *
 * @param   method          HTTP method
 * @param   path            API path, e.g. /v1/qan/metrics:getReport
 * @param   body            JSON request body
 * @param   adminPassword   PMM Server admin password
 */
export async function pmmServerApi(method: 'GET' | 'POST', path: string, body?: object, adminPassword = process.env.ADMIN_PASSWORD || 'admin') {
  const data = body ? ` -H 'Content-Type: application/json' -d '${JSON.stringify(body)}'` : '';
  const output = await exec(`docker exec pmm-server curl -sSf -u 'admin:${adminPassword}' -X ${method}${data} http://127.0.0.1:8080${path}`);
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
 * @return  label sets of the returned series
 */
export async function queryVictoriaMetrics(query: string, adminPassword = process.env.ADMIN_PASSWORD || 'admin'): Promise<Record<string, string>[]> {
  const output = await exec(`docker exec pmm-server curl -sSf -u 'admin:${adminPassword}' -G http://127.0.0.1:8080/prometheus/api/v1/query --data-urlencode 'query=${query}'`);
  await output.assertSuccess();
  const response = JSON.parse(output.stdout) as { data: { result: { metric: Record<string, string> }[] } };

  return response.data.result.map((series) => series.metric);
}

/**
 * QAN query classes of a service and database since a point in time
 *
 * @param   serviceName     service the queries ran on
 * @param   database        database the queries ran in
 * @param   from            start of the period
 */
export async function getQanQueries(serviceName: string, database: string, from: Date): Promise<{ queryId: string, fingerprint: string }[]> {
  const report = await pmmServerApi('POST', '/v1/qan/metrics:getReport', {
    period_start_from: from.toISOString(),
    period_start_to: new Date(Date.now() + 60_000).toISOString(),
    group_by: 'queryid',
    columns: ['num_queries'],
    limit: 100,
    labels: [{ key: 'service_name', value: [serviceName] }, { key: 'database', value: [database] }],
  }) as { rows?: { dimension?: string, fingerprint?: string }[] };

  return (report.rows ?? [])
    .filter((row) => row.dimension)
    .map((row) => ({ queryId: row.dimension!, fingerprint: row.fingerprint ?? '' }));
}

/**
 * Latest QAN example of a query class since a point in time
 *
 * @param   queryId         QAN query ID
 * @param   from            start of the period
 */
export async function getQanExample(queryId: string, from: Date): Promise<{ example: string, isTruncated: boolean }> {
  const response = await pmmServerApi('POST', '/v1/qan/query:getExample', {
    period_start_from: from.toISOString(),
    period_start_to: new Date(Date.now() + 60_000).toISOString(),
    filter_by: queryId,
    group_by: 'queryid',
    limit: 1,
  }) as { query_examples?: { example?: string, is_truncated?: number }[] };
  const [example] = response.query_examples ?? [];

  return { example: example?.example ?? '', isTruncated: example?.is_truncated === 1 };
}
