import validateArgs from "./helpers/validateArgs";
import { executeCommand, installAnsible, setDefaultEnvVariables, setEnvVariable } from "./helpers/commandLine";
import { availableSetups, SetupsInterface } from "./availableArgs";
import setup_pmm_client_tarball from "./pmmClient/pmm2ClientTarbal";
import { recreateNetwork, stopAndRemoveContainer } from "./helpers/docker";
import SetupParameters from "./helpers/setupParameters.interface";
import * as core from '@actions/core';
import * as dotenv from 'dotenv'

export const dockerNetworkName = "pmm-integration-network"
export const pmmIntegrationClientName = 'pmm-integration-client'
export const pmmIntegrationServerName = 'pmm-integration-server'
export const pmmIntegrationDataName = 'pmm-integration-data'

dotenv.config()

const run = async () => {
  let parameters: SetupParameters = {};
  const commandLineArgs: string[] = process.argv.slice(2);

  validateArgs(commandLineArgs);

  for await (const [_index, value] of commandLineArgs.entries()) {
    switch (true) {
      case value.includes('--pgsql-version'):
        parameters.pgsqlVersion = value.split("=")[1];
        await setEnvVariable('PGSQL_VERSION', parameters.pgsqlVersion);
        break;
      case value.includes('--mo-version'):
        parameters.moVersion = value.split("=")[1];
        await setEnvVariable('MO_VERSION', parameters.moVersion);
        break;
      case value.includes('--mo-setup'):
        parameters.moSetup = value.split("=")[1];
        await setEnvVariable('MO_SETUP', parameters.moSetup);
        break;
      case value.includes('--ps-version'):
        parameters.psVersion = value.split("=")[1];
        await setEnvVariable('PS_VERSION', parameters.psVersion);
        break;
      case value.includes('--pmm-client-version'):
        parameters.pmmClientVersion = value.split("=")[1];
        await setEnvVariable('PMM_CLIENT_VERSION', parameters.pmmClientVersion);
        break;
      case value.includes('--pmm-server-version'):
          parameters.pmmServerVersion = value.split("=")[1];
          await setEnvVariable('PMM_CLIENT_VERSION', parameters.pmmServerVersion);
          break;
      case value.includes('--query-source'):
        parameters.querySource = value.split("=")[1];
      case value.includes('--setup-pmm-client-tarball'):
        let tarballURL = value.split("=")[1];
        await setup_pmm_client_tarball(tarballURL)
        break;
      default:
        break
    }
  }

  await setDefaultEnvVariables(parameters);

  if(!commandLineArgs.includes('--clear-all-setups')) {
    if(process.env.CI) {
      await installAnsible();
    } else {
      await recreateNetwork(dockerNetworkName);
      await stopAndRemoveContainer(pmmIntegrationServerName);
      await stopAndRemoveContainer(pmmIntegrationClientName);
      await executeCommand(`docker volume create ${pmmIntegrationDataName}`)
      await executeCommand(`docker run -d --restart always -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443 --network="${dockerNetworkName}" --publish 8080:80 --publish 8443:443 --name ${pmmIntegrationServerName} perconalab/pmm-server:${parameters.pmmServerVersion}`);
      await executeCommand('sleep 60');
      await executeCommand(`docker run -d --name ${pmmIntegrationClientName} -v ${pmmIntegrationDataName}:/var/log/ --network="pmm-integration-network" -e PMM_AGENT_SERVER_ADDRESS=${pmmIntegrationServerName} -e PMM_AGENT_SERVER_USERNAME=admin -e PMM_AGENT_SERVER_PASSWORD=admin -e PMM_AGENT_SERVER_INSECURE_TLS=1 -e PMM_AGENT_SETUP=1 -e PMM_AGENT_CONFIG_FILE=config/pmm-agent.yaml perconalab/pmm-client:${parameters.pmmClientVersion}`);
    }
  }

  for await (const [_index, value] of commandLineArgs.entries()) {
    const setup: SetupsInterface | undefined = availableSetups.find((setup) => value.includes(setup.arg) )
    if (setup) {
      await setup.function(parameters, value)
    }
  }
}

run();

export default run;
