const assert = require('assert');
const {
  AGENT_STATUS,
  AGENT_TYPE,
} = require('../../helper/constants');

const { I, remoteInstancesHelper, grafanaAPI } = inject();

module.exports = {
  async verifyServiceExistsAndHasRunningStatus(service, serviceName) {
    let responseService;

    // 60 sec ping for getting created service name
    for (let i = 0; i < 60; i++) {
      const resp = await this.apiGetServices(service.serviceType);
      const services = Object.values(resp.data).flat(Infinity);

      responseService = services.find((service) => service.service_name === serviceName);
      if (responseService !== undefined) break;

      I.wait(1);
    }

    assert.ok(responseService !== undefined, `Service ${serviceName} was not found`);
    const agents = await this.waitForRunningState(responseService.service_id);

    assert.ok(agents, `One or more agents are not running for ${service.service}`);
  },

  async waitForRunningState(serviceId) {
    // 120 sec ping for getting Running status for Agents
    for (let i = 0; i < 120; i++) {
      const resp = await this.apiGetAgents(serviceId);

      // Filter out non-empty agent arrays and flatten them into a single array
      const agents = Object.values(resp.data).flat().filter((entry) => entry);

      // Check if all agents have the status "AGENT_STATUS.RUNNING"
      const areRunning = agents.every(({ status, agent_type }) => {
        if (agent_type !== 'pmm-agent') {
          return status === AGENT_STATUS.RUNNING;
        }

        return true;
      });

      if (areRunning) {
        return resp;
      }

      await I.wait(1);
    }

    return false;
  },

  async apiGetNodeInfoByServiceName(serviceType, serviceName, excludeSubstring) {
    const resp = await this.apiGetServices(serviceType);

    const data = Object.values(resp.data).flat()
      .filter(({ service_name }) => {
        if (service_name) return service_name.includes(serviceName);

        return null;
      });

    if (data.length === 0) await I.say(`Service "${serviceName}" of "${serviceType}" type is not found!`);

    if (excludeSubstring) {
      return data.find(({ service_name }) => !service_name.includes(excludeSubstring));
    }

    return data ? data[0] : null;
  },

  async getServiceDetailsByPartialName(serviceName) {
    const service = await this.apiGetServices();

    assert.ok(
      service.status === 200,
      `Failed to getService. Response message is "${service.data.message}"`,
    );

    return service
      .data
      .services
      .find((service) => service.service_name.includes(serviceName));
  },

  async getServiceDetailsByStartsWithName(serviceName) {
    const service = await this.apiGetServices();

    assert.ok(
      service.status === 200,
      `Failed to getService. Response message is "${service.data.message}"`,
    );

    return service
      .data
      .services
      .find((service) => service.service_name.startsWith(serviceName));
  },

  async getServiceDetailsByPartialDetails(details) {
    const services = await this.apiGetServices();

    assert.ok(
      services.status === 200,
      `Failed to getService. Response message is "${services.data.message}"`,
    );

    const foundServices = services.data.services
      .find((service) => Object.entries(details).every(([key, value]) => service[key].includes(value))) || null;

    if (foundServices === null) {
      throw new Error(`Service with details "${JSON.stringify(details)}" not found.`);
    }

    return foundServices;
  },

  async getServiceListDetailsByPartialDetails(details) {
    const services = await this.apiGetServices();

    assert.ok(
      services.status === 200,
      `Failed to getService. Response message is "${services.data.message}"`,
    );

    return services.data.services
      .filter((service) => Object.entries(details).every(([key, value]) => service[key].includes(value))) || null;
  },

  async apiGetPMMAgentInfoByServiceId(serviceId, agentType = AGENT_TYPE.PMM_AGENT) {
    const resp = await this.apiGetAgents(serviceId);

    const agent = resp.data.agents
      .find(({ agent_type }) => agent_type === agentType);

    await I.say(JSON.stringify(agent, null, 2));

    return agent;
  },

  async apiGetAgents(serviceId) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const url = serviceId ? `v1/management/agents?service_id=${serviceId}` : 'v1/inventory/agents';

    return I.sendGetRequest(url, headers);
  },

  async apiGetAgentDetailsViaAgentId(agentId) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    return I.sendGetRequest(`v1/inventory/agents/${agentId}`, headers);
  },

  async apiGetAgentsViaNodeId(nodeId) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    return I.sendGetRequest(`v1/inventory/agents?node_id=${nodeId}`, headers);
  },

  async apiGetServices() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const url = 'v1/management/services';

    return await I.sendGetRequest(url, headers);
  },

  async getServicesByType(serviceType) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const url = `v1/inventory/services?service_type=${serviceType}`;

    return await I.sendGetRequest(url, headers);
  },

  async verifyServiceIdExists(serviceId) {
    const services = await this.apiGetServices(remoteInstancesHelper.serviceTypes.postgresql.serviceType);

    const present = Object.values(services.data)
      .flat(Infinity)
      .find(({ service_id }) => service_id === serviceId);

    assert.ok(present, `Service with ID ${serviceId} does not exist.`);
  },

  async getServiceById(serviceId) {
    const resp = await this.apiGetServices();

    return resp.data.services.filter(({ service_id }) => service_id === serviceId);
  },

  /**
   * Searches node by related service name and deletes if found using v1 API
   *
   * @param   serviceType   {@link remoteInstancesHelper.serviceTypes.*.serviceType}
   * @param   serviceName   name of the service to search
   * @param   force         {@link Boolean} flag
   * @returns {Promise<void>}
   */
  async deleteNodeByServiceName(serviceType, serviceName, force = true) {
    const node = await this.apiGetNodeInfoByServiceName(serviceType, serviceName);

    if (node) {
      await this.deleteNode(node.node_id, force);
    } else {
      await I.say(`Node for "${serviceName}" service is not found!`);
    }
  },

  async deleteNodeByName(nodeName, force = true) {
    const node = await this.getNodeByName(nodeName);

    if (node) {
      await this.deleteNode(node.node_id, force);
    } else {
      await I.say(`Node with name "${nodeName}" is not found!`);
    }
  },

  async deleteNode(nodeID, force) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendDeleteRequest(`v1/management/nodes/${nodeID}?force=${force}`, headers);

    assert.ok(
      resp.status === 200,
      `Failed to delete Node. Response message is "${resp.data.message}"`,
    );
  },

  async deleteService(serviceId, force = true) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendDeleteRequest(`v1/management/services/${serviceId}?force=${force}`, headers);

    assert.ok(
      resp.status === 200,
      `Failed to delete Service. Response message is "${resp.data.message}"`,
    );
  },

  async getNodeByName(nodeName) {
    const nodes = await this.getAllNodes();

    const node = Object.values(nodes)
      .flat(Infinity)
      .find(({ node_name }) => node_name === nodeName);

    return node || null;
  },

  async getAllNodes() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendGetRequest('v1/management/nodes', headers);

    return resp.data.nodes || [];
  },

  async getNodeName(nodeID) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendGetRequest(`v1/management/nodes/${nodeID}`, headers);

    const values = Object.values(resp.data)
      .flat(Infinity)
      .find(({ node_id }) => node_id === nodeID);

    return values.node_name;
  },

  async getNodeByServiceName(serviceName) {
    const nodes = await this.getAllNodes();

    return nodes.find((node) => node.services.some((service) => service.service_name === serviceName));
  },

  async verifyAgentLogLevel(agentType, dbDetails, logLevel) {
    let agent_id;
    let output;
    let log_level;
    const logLvlFlag = logLevel ? `--log-level=${logLevel}` : '';

    const expectedLogLevel = logLevel === 'warn' ? 'LOG_LEVEL_UNSPECIFIED' : logLevel || 'LOG_LEVEL_UNSPECIFIED';

    switch (agentType) {
      case 'mongodb':
        agent_id = (await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory add agent mongodb-exporter --password=${dbDetails.password} --push-metrics ${logLvlFlag} ${dbDetails.pmm_agent_id} ${dbDetails.service_id} ${dbDetails.username} | grep "Agent ID" | grep -v "PMM-Agent ID" | awk -F " " '{print $4}'`)).trim();
        output = await this.apiGetAgentDetailsViaAgentId(agent_id);
        await I.say(JSON.stringify(output.data, null, 2));
        log_level = output.data.mongodb_exporter.log_level;
        await grafanaAPI.waitForMetric('mongodb_up', [{ type: 'agent_id', value: agent_id }], 90);

        I.say(`Expecting to have ${logLevel} for agent ${agentType} when using ${logLvlFlag}, expected log level is ${expectedLogLevel}`);
        I.assertEqual(log_level, expectedLogLevel, `Was expecting Mongo Exporter for service ${dbDetails.service_name} added again via inventory command and log level to have ${logLevel || 'warn'} set`);
        break;
      case 'node':
        agent_id = (await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory add agent node-exporter --push-metrics ${logLvlFlag} ${dbDetails.pmm_agent_id} | grep "Agent ID" | grep -v "PMM-Agent ID" | awk -F " " '{print $4}'`)).trim();
        output = await this.apiGetAgentDetailsViaAgentId(agent_id);
        log_level = output.data.node_exporter.log_level;
        await grafanaAPI.waitForMetric('node_memory_MemTotal_bytes', [{ type: 'agent_id', value: agent_id }], 90);
        assert.ok(log_level === expectedLogLevel, `Was expecting Node Exporter for service ${dbDetails.service_name} added again via inventory command and log level to have ${logLevel || 'warn'} set`);
        break;
      case 'mongodb_profiler':
        agent_id = (await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory add agent qan-mongodb-profiler-agent --password=${dbDetails.password} ${logLvlFlag} ${dbDetails.pmm_agent_id} ${dbDetails.service_id} ${dbDetails.username} | grep "Agent ID" | grep -v "PMM-Agent ID" | awk -F " " '{print $4}'`)).trim();
        output = await this.apiGetAgentDetailsViaAgentId(agent_id);
        log_level = output.data.qan_mongodb_profiler_agent.log_level;

        // Wait for Status to change to running
        I.wait(10);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin list | grep mongodb_profiler_agent | grep ${agent_id} | grep ${dbDetails.service_id} | grep "Running"`);
        assert.ok(log_level === expectedLogLevel, `Was expecting MongoDB QAN Profile for service ${dbDetails.service_name} added again via inventory command and log level to have ${logLevel || 'warn'} set`);
        break;
      case 'postgresql':
        agent_id = (await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory add agent postgres-exporter --password=${dbDetails.password} --push-metrics ${logLvlFlag} ${dbDetails.pmm_agent_id} ${dbDetails.service_id} ${dbDetails.username} | grep "Agent ID" | grep -v "PMM-Agent ID" | awk -F " " '{print $4}'`)).trim();
        output = await this.apiGetAgentDetailsViaAgentId(agent_id);
        log_level = output.data.postgres_exporter.log_level;

        await grafanaAPI.waitForMetric('pg_up', [{ type: 'agent_id', value: agent_id }], 90);
        assert.ok(log_level === expectedLogLevel, `Was expecting Postgresql Exporter for service ${dbDetails.service_name} added again via inventory command and log level to have ${logLevel || 'warn'} set`);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory remove agent ${agent_id}`);
        break;
      case 'pgstatmonitor':
        agent_id = (await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory add agent qan-postgresql-pgstatmonitor-agent --password=${dbDetails.password} ${logLvlFlag} ${dbDetails.pmm_agent_id} ${dbDetails.service_id} ${dbDetails.username} | grep "Agent ID" | grep -v "PMM-Agent ID" | awk -F " " '{print $4}'`)).trim();
        output = await this.apiGetAgentDetailsViaAgentId(agent_id);
        log_level = output.data.qan_postgresql_pgstatmonitor_agent.log_level;

        // Wait for Status to change to running
        I.wait(10);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin list | grep postgresql_pgstatmonitor_agent | grep ${agent_id} | grep ${dbDetails.service_id} | grep "Running"`);
        assert.ok(log_level === expectedLogLevel, `Was expecting PGSTAT_MONITOR QAN for service ${dbDetails.service_name} added again via inventory command and log level to have ${logLevel || 'warn'} set`);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory remove agent ${agent_id}`);
        break;
      case 'pgstatements':
        agent_id = (await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory add agent qan-postgresql-pgstatements-agent --password=${dbDetails.password} ${logLvlFlag} ${dbDetails.pmm_agent_id} ${dbDetails.service_id} ${dbDetails.username} | grep "Agent ID" | grep -v "PMM-Agent ID" | awk -F " " '{print $4}'`)).trim();
        output = await this.apiGetAgentDetailsViaAgentId(agent_id);
        log_level = output.data.qan_postgresql_pgstatements_agent.log_level;

        // Wait for Status to change to running
        I.wait(10);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin list | grep postgresql_pgstatements_agent | grep ${agent_id} | grep ${dbDetails.service_id} | grep "Running"`);
        assert.ok(log_level === expectedLogLevel, `Was expecting PGSTATSTATEMENT QAN for service ${dbDetails.service_name} added again via inventory command and log level to have ${logLevel || 'warn'} set`);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory remove agent ${agent_id}`);
        break;
      case 'mysql':
        agent_id = (await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory add agent mysqld-exporter --password=${dbDetails.password} --push-metrics ${logLvlFlag} ${dbDetails.pmm_agent_id} ${dbDetails.service_id} ${dbDetails.username} | grep "Agent ID" | grep -v "PMM-Agent ID" | awk -F " " '{print $4}'`)).trim();
        output = await this.apiGetAgentDetailsViaAgentId(agent_id);
        log_level = output.data.mysqld_exporter.log_level;

        await grafanaAPI.waitForMetric('mysql_up', [{ type: 'agent_id', value: agent_id }], 90);
        assert.ok(log_level === expectedLogLevel, `Was expecting Mysql Exporter for service ${dbDetails.service_name} added again via inventory command and log level to have ${logLevel || 'warn'} set`);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory remove agent ${agent_id}`);
        break;
      case 'qan-slowlog':
        agent_id = (await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory add agent qan-mysql-slowlog-agent --password=${dbDetails.password} ${logLvlFlag} ${dbDetails.pmm_agent_id} ${dbDetails.service_id} ${dbDetails.username} | grep "Agent ID" | grep -v "PMM-Agent ID" | awk -F " " '{print $4}'`)).trim();

        await I.asyncWaitFor(async () => {
          output = await this.apiGetAgentDetailsViaAgentId(agent_id);
          const { status } = output.data.qan_mysql_slowlog_agent;

          return status === AGENT_STATUS.RUNNING;
        }, 20);

        log_level = output.data.qan_mysql_slowlog_agent.log_level;

        I.say(JSON.stringify(output.data, null, 2));
        I.say(await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin list | grep mysql_slowlog_agent | grep ${agent_id} | grep ${dbDetails.service_id}`));

        // Wait for Status to change to running
        I.wait(10);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin list | grep mysql_slowlog_agent | grep ${agent_id} | grep ${dbDetails.service_id} | grep "Running"`);
        assert.ok(log_level === expectedLogLevel, `Was expecting Slowlog QAN for service ${dbDetails.service_name} added again via inventory command and log level to have ${logLevel || 'warn'} set`);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory remove agent ${agent_id}`);
        break;
      case 'qan-perfschema':
        agent_id = (await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory add agent qan-mysql-perfschema-agent --password=${dbDetails.password} ${logLvlFlag} ${dbDetails.pmm_agent_id} ${dbDetails.service_id} ${dbDetails.username} | grep "Agent ID" | grep -v "PMM-Agent ID" | awk -F " " '{print $4}'`)).trim();
        output = await this.apiGetAgentDetailsViaAgentId(agent_id);
        log_level = output.data.qan_mysql_perfschema_agent.log_level;

        // Wait for Status to change to running
        I.wait(10);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin list | grep mysql_perfschema_agent | grep ${agent_id} | grep ${dbDetails.service_id} | grep "Running"`);
        assert.ok(log_level === expectedLogLevel, `Was expecting PerfSchema QAN for service ${dbDetails.service_name} added again via inventory command and log level to have ${logLevel || 'warn'} set`);
        await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory remove agent ${agent_id}`);
        break;
      default:
    }
  },
};
