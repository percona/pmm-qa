import validateArgs from "./helpers/validateArgs";
import { executeCommand, installAnsible, setDefaultEnvVariables } from "./helpers/commandLine";
import { availableSetups, SetupsInterface } from "./availableArgs";
import setup_pmm_client_tarball from "./pmmClient/pmm2ClientTarbal";
import { recreateNetwork, stopAndRemoveContainer } from "./helpers/docker";
import SetupParameters from "./helpers/setupParameters.interface";
import pmmServerSetup from './pmmServer/pmmServerSetup'

export const dockerNetworkName = "pmm-integration-network"
export const pmmIntegrationClientName = 'pmm-integration-client'
export const pmmIntegrationServerName = 'pmm-integration-server'
export const pmmIntegrationDataName = 'pmm-integration-data'

const run = async () => {
  let parameters: SetupParameters = {};
  const commandLineArgs: string[] = process.argv.slice(2);

  validateArgs(commandLineArgs);

  for await (const [_index, value] of commandLineArgs.entries()) {
    switch (true) {
      case value.includes('--pgsql-version'):
        parameters.pgsqlVersion = value.split("=")[1];
        break;
      case value.includes('--pdpgsql-version'):
        parameters.pdpgsqlVersion = value.split("=")[1];
        break;
      case value.includes('--mo-version'):
        parameters.moVersion = value.split("=")[1];
        break;
      case value.includes('--mo-setup'):
        parameters.moSetup = value.split("=")[1];
        break;
      case value.includes('--ps-version'):
        parameters.psVersion = parseFloat(value.split("=")[1]);
        break;
      case value.includes('--pmm-client-version'):
        parameters.pmmClientVersion = value.split("=")[1];
        break;
      case value.includes('--pmm-server-version'):
        const pmmServerVersion = value.split("=")[1];
        if(pmmServerVersion.length > 0) {
          parameters.pmmServerVersions = { 
            versionMajor: parseInt(pmmServerVersion.split('.')[0]),
            versionMinor: parseInt(pmmServerVersion.split('.')[1]),
            versionPatch: parseInt(pmmServerVersion.split('.')[2]),
          }
        }
        console.log(parameters.pmmServerVersions);
        parameters.pmmServerVersion = value.split("=")[1];
        break;
      case value.includes('--query-source'):
        parameters.querySource = value.split("=")[1];
        break;
      case value.includes('--setup-pmm-client-tarball'):
        let tarballURL = value.split("=")[1];
        await setup_pmm_client_tarball(tarballURL)
        break;
      case value.includes('--ci'):
        parameters.ci = true;
        break;
      case value.includes('--rbac'):
        parameters.rbac = true;
        break;
      case value.includes('--pmm-server-docker-tag'):
        parameters.pmmServerDockerTag = value.split('=')[1];
        break;
      default:
        break
    }
  }

  await setDefaultEnvVariables(parameters);

  if(!commandLineArgs.includes('--clear-all-setups')) {
    await recreateNetwork(dockerNetworkName);
    if(!parameters.ci) {
      await stopAndRemoveContainer(pmmIntegrationServerName);
      await stopAndRemoveContainer(pmmIntegrationClientName);
      await executeCommand(`docker volume create ${pmmIntegrationDataName}`)
      await pmmServerSetup(parameters);
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
