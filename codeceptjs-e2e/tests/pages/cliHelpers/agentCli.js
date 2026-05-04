const { AGENT_STATUS } = require('../../helper/constants');

const { I, inventoryAPI } = inject();

class AgentCli {
  async verifyAgentLogLevel(exporterType, dbDetails, logLevel = 'warn') {
    const logLvlFlag = logLevel ? `--log-level=${logLevel}` : '';
    const addAgentResponse = await I.verifyCommand(`docker exec ${dbDetails.container_name} \
                                                    pmm-admin inventory add agent ${exporterType} \
                                                    --password=${dbDetails.password} \
                                                    ${exporterType === 'mysqld-exporter' ? '--push-metrics' : ''} \
                                                    ${logLvlFlag} ${dbDetails.pmm_agent_id} ${dbDetails.service_id} \
                                                    ${dbDetails.username}`);
    const agent_id = addAgentResponse.split('\n').find((row) => row.includes('Agent ID')).split(':')[1].trim();

    const actualLogLevel = await getLogLevel(agent_id, exporterType);
    const expectedLogLevel = getLogLevelResponse(logLevel);

    I.say(`Actual log level is: ${actualLogLevel}`);
    I.assertEqual(
      actualLogLevel,
      expectedLogLevel,
      `Expecting exporter for service ${dbDetails.service_name} added to have log level: ${expectedLogLevel} set, actual log level was: ${actualLogLevel}`,
    );

    await I.verifyCommand(`docker exec ${dbDetails.container_name} pmm-admin inventory remove agent ${agent_id}`);
  }
}

async function getLogLevel(agentId, exporterType) {
  let output;

  await I.asyncWaitFor(async () => {
    output = await inventoryAPI.apiGetAgentDetailsViaAgentId(agentId);
    const { status } = output.data[exporterType.replaceAll('-', '_')];

    return status === AGENT_STATUS.RUNNING;
  }, 30);

  await I.say(JSON.stringify(output.data, null, 2));

  return output.data[exporterType.replaceAll('-', '_')].log_level;
}

function getLogLevelResponse(logLevelFlag) {
  switch (logLevelFlag) {
    case 'warn':
      return 'LOG_LEVEL_WARN';
    case 'debug':
      return 'LOG_LEVEL_DEBUG';
    case 'info':
      return 'LOG_LEVEL_INFO';
    case 'error':
      return 'LOG_LEVEL_ERROR';
    default:
      throw new Error(`Log Level: ${logLevelFlag} is not supported`);
  }
}

module.exports = new AgentCli();
module.exports.AgentCli = AgentCli;
