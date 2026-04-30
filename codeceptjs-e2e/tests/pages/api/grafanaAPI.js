const { I } = inject();
const assert = require('assert');

module.exports = {
  customDashboardName: 'auto-test-dashboard',
  customFolderName: 'auto-test-folder',
  customPanelName: 'Monitored DB',
  randomDashboardName: 'uto-dashboard-custom',
  randomTag: 'tag-random',

  /**
   * Simulates adding new dashboard with custom panels via inner grafana API to keep test
   * resistance to UI changes in different Grafans versions.
   *
   * @param   name              a dashboard name
   * @param   folderId          folder ID to store new dashboard in. "General" folder ID is 0.
   * @param   additionalPanels  Array of objects with panels to insert into the dashboard.
   * @param   tags              a list of tags to apply to dashboard
   * @return  {Promise<*>}      response object
   */
  async createCustomDashboard(name, folderId, additionalPanels, tags = ['pmm-qa']) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      dashboard: {
        annotations: {
          list: [
            {
              builtIn: 1,
              datasource: '-- Grafana --',
              enable: true,
              hide: true,
              iconColor: 'rgba(0, 211, 255, 1)',
              name: 'Annotations & Alerts',
              type: 'dashboard',
            },
          ],
        },
        editable: true,
        panels: [
          {
            title: this.customPanelName,
            type: 'stat',
            datasource: 'Metrics',
            gridPos: {
              h: 5,
              w: 12,
              x: 0,
              y: 0,
            },
            id: 2,
            targets: [
              {
                datasource: 'Metrics',
                editorMode: 'code',
                expr: 'count by (service_type) (mysql_global_status_uptime)',
                format: 'time_series',
                hide: false,
                intervalFactor: 1,
                legendFormat: 'MySQL',
                range: true,
                refId: 'A',
              },
              {
                datasource: 'Metrics',
                editorMode: 'code',
                expr: 'count by (service_type) (mongodb_up)',
                hide: false,
                legendFormat: 'MongoDB',
                range: true,
                refId: 'B',
              },
              {
                datasource: 'Metrics',
                editorMode: 'code',
                expr: 'count by (service_type)  (group by (service_name, service_type) (pg_up))',
                hide: false,
                legendFormat: 'PostgreSQL',
                range: true,
                refId: 'C',
              },
              {
                datasource: 'Metrics',
                editorMode: 'code',
                expr: 'count by (service_type)  (group by (service_name, service_type) (proxysql_mysql_status_active_transactions))',
                hide: false,
                legendFormat: 'ProxySQL',
                range: true,
                refId: 'D',
              },
            ],
            fieldConfig: {
              defaults: {
                color: {
                  fixedColor: 'rgb(31, 120, 193)',
                  mode: 'fixed',
                },
                links: [],
                mappings: [
                  {
                    options: {
                      match: 'null',
                      result: {
                        index: 0,
                        text: 'N/A',
                      },
                    },
                    type: 'special',
                  },
                ],
                thresholds: {
                  mode: 'absolute',
                  steps: [
                    {
                      color: '#1F60C4',
                      value: null,
                    },
                    {
                      color: 'rgba(237, 129, 40, 0.89)',
                      value: 100,
                    },
                    {
                      color: '#d44a3a',
                    },
                  ],
                },
                unit: 'none',
              },
              overrides: [],
            },

            links: [],
            maxDataPoints: 100,
            options: {
              colorMode: 'value',
              graphMode: 'none',
              justifyMode: 'center',
              orientation: 'vertical',
              reduceOptions: {
                calcs: [
                  'lastNotNull',
                ],
                fields: '',
                values: false,
              },
              text: {
                titleSize: 14,
                valueSize: 24,
              },
              textMode: 'auto',
            },
            pluginVersion: '9.2.20',

          },
        ],
        schemaVersion: 26,
        style: 'dark',
        time: {
          from: 'now-6h',
          to: 'now',
        },
        title: name,
        tags,
        version: 0,
      },
      folderId,
    };

    if (additionalPanels && additionalPanels.length > 0) {
      additionalPanels.forEach((i) => body.dashboard.panels.push(i));
    }

    const resp = await I.sendPostRequest('graph/api/dashboards/db/', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to create custom dashboard. Response message is ${resp.data.message}`,
    );

    return resp.data;
  },

  async deleteDashboard(uid) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendDeleteRequest(`graph/api/dashboards/uid/${uid}`, headers);

    assert.ok(
      resp.status === 200,
      `Failed to delete dashboard with uid '${uid}' . Response message is ${resp.data.message}`,
    );
  },

  async starDashboard(id) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendPostRequest(`graph/api/user/stars/dashboard/${id}`, {}, headers);

    assert.ok(
      resp.status === 200,
      `Failed to star dashboard with id '${id}' . Response message is ${resp.data.message}`,
    );
  },

  async getDashboard(uid) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendGetRequest(`graph/api/dashboards/uid/${uid}`, headers);

    assert.ok(
      resp.status === 200,
      `Failed to find dashboard with id '${uid}' . Response message is ${resp.data.message}`,
    );

    return resp.data;
  },

  async setHomeDashboard(id) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      homeDashboardId: id,
    };

    const resp = await I.sendPutRequest('graph/api/org/preferences', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to set custom Home dashboard '${id}'. Response message is ${resp.data.message}`,
    );
  },

  async savePanelToLibrary(name, folderId = 0) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const payload = {
      folderId,
      name,
      model: {
        libraryPanel: { name },
        id: 4,
        gridPos: {
          h: 9, w: 12, x: 0, y: 6,
        },
        title: name,
        type: 'stat',
        targets: [
          {
            datasource: 'Metrics',
            expr: 'sum by () (node_memory_MemTotal_bytes)',
            refId: 'B',
          },
        ],
        datasource: 'Metrics',
        maxDataPoints: 100,
        interval: '$interval',
        links: [],
        fieldConfig: {
          defaults: {
            mappings: [
              {
                options: {
                  match: 'null',
                  result: {
                    text: 'N/A',
                  },
                },
                type: 'special',
              },
            ],
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: '#0a437c', value: null },
                { color: '#1f78c1', value: 10000000 },
                { color: '#5195ce', value: 100000000 },
              ],
            },
            color: { fixedColor: 'rgb(31, 120, 193)', mode: 'fixed' },
            decimals: 1,
            links: [],
            unit: 'Bps',
          },
          overrides: [],
        },
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
            fields: '',
          },
          orientation: 'auto',
          textMode: 'value',
          colorMode: 'none',
          graphMode: 'area',
          justifyMode: 'auto',
          text: { valueSize: 24 },
        },
      },
      kind: 1,
    };

    const resp = await I.sendPostRequest('graph/api/library-elements', payload, headers);

    I.assertEqual(
      resp.status,
      200,
      `Failed to save "${name}" panel to libraries. Response message is ${resp.data.message}`,
    );

    return resp.data;
  },

  async createFolder(name) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      title: name,
    };
    const resp = await I.sendPostRequest('graph/api/folders', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to create "${name}" folder. Response message is ${resp.data.message}`,
    );

    return resp.data;
  },

  async lookupFolderByName(name) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendGetRequest('graph/api/folders', headers);

    const result = resp.data.filter((obj) => obj.title === name);

    return result.length > 0 ? result[0] : null;
  },

  async deleteFolder(uid) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendDeleteRequest(`graph/api/folders/${uid}`, headers);

    assert.ok(
      resp.status === 200,
      `Failed to delete folder with uid '${uid}' . Response message is ${resp.data.message}`,
    );
  },

  async getDataSourceUidByName(name = 'Metrics') {
    const headers = {
      Authorization: `Basic ${await I.getAuth()}`,
    };

    const r = await I.sendGetRequest(
      'graph/api/datasources',
      headers,
    );

    return (r.data.find((d) => d.name === name)).uid;
  },

  // Refactored function for new Grafana Explore UI format
  async getMetric(metricName, refineBy, lastMinutes = 5) {
    const uid = await this.getDataSourceUidByName();
    const currentTime = Date.now();
    const fromTime = currentTime - lastMinutes * 60 * 1000;
    let refineByString = '';

    if (Array.isArray(refineBy)) {
      // Handle refineBy as an array of objects
      refineByString = refineBy
        .filter(({ type, value }) => type && value)
        .map(({ type, value }) => `${type}="${value}"`)
        .join(',');
    } else if (refineBy && refineBy.type && refineBy.value) {
      // Handle refineBy as a single object with both type and value defined
      refineByString = `${refineBy.type}="${refineBy.value}"`;
    }

    const body = {
      queries: [
        {
          refId: 'A',
          expr: refineByString ? `${metricName}{${refineByString}}` : metricName,
          range: true,
          instant: false,
          datasource: {
            type: 'prometheus',
            uid,
          },
          editorMode: 'builder',
          legendFormat: '__auto',
          useBackend: false,
          disableTextWrap: false,
          fullMetaSearch: false,
          includeNullMetadata: true,
          requestId: '17102A',
          utcOffsetSec: 19800,
          interval: '',
          datasourceId: 1,
          intervalMs: 1000,
          maxDataPoints: 757,
        },
        {
          refId: 'A-Instant',
          expr: refineByString ? `${metricName}{${refineByString}}` : metricName,
          range: false,
          instant: true,
          datasource: {
            type: 'prometheus',
            uid,
          },
          editorMode: 'builder',
          legendFormat: '__auto',
          useBackend: false,
          disableTextWrap: false,
          fullMetaSearch: false,
          includeNullMetadata: true,
          requestId: '17102A',
          utcOffsetSec: 19800,
          interval: '',
          datasourceId: 1,
          intervalMs: 1000,
          maxDataPoints: 757,
        },
      ],
      from: fromTime.toString(),
      to: currentTime.toString(),
    };

    const headers = {
      Authorization: `Basic ${await I.getAuth()}`,
    };

    return await I.sendPostRequest(
      'graph/api/ds/query?ds_type=prometheus&requestId=explore_sbu',
      body,
      headers,
    );
  },

  /**
   * Fluent wait for a specified metric to have non-empty body.
   * Fails test if timeout exceeded.
   *
   * @param     metricName          name of the metric to lookup
   * @param     queryBy             PrometheusQL expression, ex.: {node_name='MySQL Node'}
   * @param     timeOutInSeconds    time to wait for a service to appear
   * @returns   {Promise<Object>}   response Object, requires await when called
   */
  async waitForMetric(metricName, queryBy, timeOutInSeconds = 30) {
    const start = new Date().getTime();
    const timout = timeOutInSeconds * 1000;
    const interval = 1;

    await I.say(`Wait ${timeOutInSeconds} seconds for Metrics ${metricName} with filters as ${JSON.stringify(queryBy)} being collected`);

    /* eslint no-constant-condition: ["error", { "checkLoops": false }] */
    while (true) {
      // Main condition check: metric body is not empty
      const response = await this.getMetric(metricName, queryBy);

      if (response.data.results.A.frames[0].data.values.length !== 0) {
        return response.data;
      }

      // Check the timeout after evaluating main condition
      // to ensure conditions with a zero timeout can succeed.
      if (new Date().getTime() - start >= timout) {
        assert.fail(`Metrics "${metricName}" is empty: 
        tried to check for ${timeOutInSeconds} second(s) with ${interval} second(s) with interval`);
      }

      I.wait(interval);
    }
  },

  /**
   * Fluent wait for a specified metric to have empty body.
   * Fails test if timeout exceeded.
   *
   * @param     metricName          name of the metric to lookup
   * @param     queryBy             PrometheusQL expression, ex.: {node_name='MySQL Node'}
   * @param     timeOutInSeconds    time to wait for a service to appear
   * @returns   {Promise<Object>}   response Object, requires await when called
   */
  async waitForMetricAbsent(metricName, queryBy, timeOutInSeconds = 30) {
    const start = new Date().getTime();
    const timout = timeOutInSeconds * 1000;
    const interval = 1;

    await I.say(`Wait ${timeOutInSeconds} seconds for Metrics ${metricName} with filters as ${JSON.stringify(queryBy)} to stop being collected`);

    /* eslint no-constant-condition: ["error", { "checkLoops": false }] */
    while (true) {
      // Main condition check: metric body is not empty
      const response = await this.getMetric(metricName, queryBy, 1);

      if (response.data.results.A.frames[0].data.values.length === 0) {
        return response;
      }

      // Check the timeout after evaluating main condition
      // to ensure conditions with a zero timeout can succeed.
      if (new Date().getTime() - start >= timout) {
        assert.fail(`Metrics "${metricName}" is still available:
        tried to check for ${timeOutInSeconds} second(s) with ${interval} second(s) with interval`);
      }

      I.wait(interval);
    }
  },

  async checkMetricExist(metricName, refineBy, lastMinutes = 5) {
    let response;

    await I.asyncWaitFor(async () => {
      response = await this.getMetric(metricName, refineBy, lastMinutes);

      return response.data.results.A.frames[0].data.values.length !== 0;
    }, 60, `failed to wait for metric "${metricName}" for ${JSON.stringify(refineBy)}`);

    const result = JSON.stringify(response.data.results);

    I.assertTrue(
      response.data.results.A.frames[0].data.values.length !== 0,
      `Metrics '${metricName}' ${refineBy === null ? '' : `with filters as ${JSON.stringify(refineBy)} `}should be available but got empty ${result}`,
    );

    return response;
  },

  async checkMetricAbsent(metricName, refineBy) {
    let response;

    await I.asyncWaitFor(async () => {
      response = await this.getMetric(metricName, refineBy);

      return response.data.results.A.frames[0].data.values.length === 0;
    }, 60);

    const result = JSON.stringify(response.data.results);

    I.assertEqual(
      response.data.results.A.frames[0].data.values.length,
      0,
      `Metrics "${metricName}" with filters as ${JSON.stringify(refineBy)} should be empty but got available ${result}`,
    );

    return response;
  },
};
