import { expect } from '@playwright/test';
import InventoryApi from '@api/inventory.api';
import CliHelper from '@helpers/cli.helper';
import { AgentStatus, LogLevel } from '@helpers/constants';
import { Timeouts } from '@helpers/timeouts';

export interface AgentDbDetails {
  container: string;
  password: string;
  pmmAgentId: string;
  serviceId: string;
  serviceName?: string;
  username: string;
}

type LogLevelFlag = 'debug' | 'error' | 'info' | 'warn';

/**
 * CLI helpers for `pmm-admin inventory` agent management.
 *
 * Ports the CodeceptJS `agentCli` page object: it adds an exporter/QAN agent
 * with a `--log-level` flag, reads the resulting log level back through the
 * inventory API, asserts it, then removes the temporary agent.
 */
export default class AgentHelper {
  private cliHelper = new CliHelper();

  verifyAgentLogLevel = async (
    inventoryApi: InventoryApi,
    exporterType: string,
    dbDetails: AgentDbDetails,
    logLevel: LogLevelFlag = 'warn',
  ) => {
    const logLevelFlag = `--log-level=${logLevel}`;
    const pushMetricsFlag = exporterType === 'mysqld-exporter' ? '--push-metrics' : '';
    const addAgentOutput = this.cliHelper
      .execSilent(
        `docker exec ${dbDetails.container} pmm-admin inventory add agent ${exporterType} ` +
          `--password=${dbDetails.password} ${pushMetricsFlag} ${logLevelFlag} ` +
          `${dbDetails.pmmAgentId} ${dbDetails.serviceId} ${dbDetails.username}`,
      )
      .assertSuccess().stdout;
    const agentId = addAgentOutput
      .split('\n')
      .find((row) => row.includes('Agent ID'))
      ?.split(':')[1]
      .trim();

    expect(agentId, `Agent ID should be present in add agent output:\n${addAgentOutput}`).toBeTruthy();

    const actualLogLevel = await this.getLogLevel(inventoryApi, agentId as string, exporterType);

    expect(
      actualLogLevel,
      `Expected exporter for service ${dbDetails.serviceName} to have log level ${LogLevel[logLevel]}`,
    ).toEqual(LogLevel[logLevel]);

    this.cliHelper
      .execSilent(`docker exec ${dbDetails.container} pmm-admin inventory remove agent ${agentId}`)
      .assertSuccess();
  };

  private getLogLevel = async (
    inventoryApi: InventoryApi,
    agentId: string,
    exporterType: string,
  ): Promise<string> => {
    const key = exporterType.replaceAll('-', '_');
    let logLevel = '';

    await expect
      .poll(
        async () => {
          const agent = (await inventoryApi.getAgentById(agentId))[key];

          logLevel = agent?.log_level ?? '';

          return agent?.status;
        },
        { intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS },
      )
      .toEqual(AgentStatus.running);

    return logLevel;
  };
}
