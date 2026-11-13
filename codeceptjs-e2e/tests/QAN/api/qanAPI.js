const assert = require('assert');

const { I } = inject();

module.exports = {
  async getMetricByFilterAPI(filter_value, filter_group, labels, fromTime, toTime) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const data = {
      filter_by: filter_value,
      group_by: filter_group,
      labels,
      period_start_from: fromTime,
      period_start_to: toTime,
      totals: false,
    };
    const resp = await I.sendPostRequest('/v1/qan:getMetrics', data, headers);

    return resp;
  },

  // QAN agents send their first bucket at the first minute boundary after they start,
  // so a service added under a minute ago may have no QAN data yet.
  async waitForServiceData(serviceName, timeoutInSeconds = 180) {
    await I.asyncWaitFor(async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 5 * 60 * 1000);
      const { data } = await this.getMetricByFilterAPI(serviceName, 'service_name', [], from.toISOString(), to.toISOString());

      return Number(data?.metrics?.num_queries?.sum) > 0;
    }, timeoutInSeconds, `QAN has no data for ${serviceName}`);
  },

  async getMetricsFromPGSM(database, queryId, connection, version) {
    let total_exec_time = 0;
    let average_exec_time = 0;
    let query_cnt = 0;
    let query_output;

    if (version < 13) {
      query_output = await I.pgExecuteQueryOnDemand(`select query, pgsm_query_id, planid, query_plan, calls, total_time as total_exec_time, mean_time as mean_exec_time  from pg_stat_monitor where datname='${database}' and pgsm_query_id='${queryId}';`, connection);
    } else {
      query_output = await I.pgExecuteQueryOnDemand(`select query, pgsm_query_id, planid, query_plan, calls, total_exec_time, mean_exec_time  from pg_stat_monitor where datname='${database}' and pgsm_query_id='${queryId}';`, connection);
    }

    average_exec_time = query_output.rows.reduce((r, c) => r + c.mean_exec_time, 0) / query_output.rows.length;

    for (let i = 0; i < query_output.rows.length; i++) {
      total_exec_time += query_output.rows[i].total_exec_time;
      query_cnt += parseInt(query_output.rows[i].calls, 10);
    }

    total_exec_time = parseFloat((total_exec_time / 1000).toFixed(7));
    average_exec_time = parseFloat((average_exec_time / 1000).toFixed(7));

    return { total_exec_time, average_exec_time, query_cnt };
  },
};
