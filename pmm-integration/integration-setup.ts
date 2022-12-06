import validateArgs from "./helpers/validateArgs";
import { executeCommand, setDefaulEnvVariables, setEnvVariable } from "./helpers/commandLine";
import { availableSetups, SetupsInterface } from "./availableArgs";
import setup_pmm_client_tarball from "./pmmClient/pmm2ClientTarbal";
import { recreateNetwork, stopAndRemoveContainer } from "./helpers/docker";
import SetupParameters from "./helpers/setupParameters.interface";
import * as core from '@actions/core';

export const dockerNetworkName = "pmm-integration-network"
export const pmmIntegrationServerName = 'pmm-integration-server'

const run = async () => {
  let parameters: SetupParameters = {};
  const commandLineArgs: string[] = process.argv.slice(2);

  validateArgs(commandLineArgs);

  await stopAndRemoveContainer(pmmIntegrationServerName);

  await recreateNetwork(dockerNetworkName);

  await executeCommand(`docker run -d --restart always -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443 --network="${dockerNetworkName}" --publish 8080:80 --publish 8443:443 --publish 7777:7777 --name ${pmmIntegrationServerName} percona/pmm-server:latest`);

  for await (const [_index, value] of commandLineArgs.entries()) {
    switch (true) {
      case value.includes('--pgsql-version'):
        parameters.pgsqlVersion = value.split("=")[1];
        await setEnvVariable('PGSQL_VERSION', parameters.pgsqlVersion);
        core.exportVariable('PGSQL_VERSION', parameters.pgsqlVersion);
        break
      case value.includes('--mo-version'):
        parameters.moVersion = value.split("=")[1];
        await setEnvVariable('MO_VERSION', parameters.moVersion);
        core.exportVariable('MO_VERSION', parameters.moVersion);
        break
      case value.includes('--setup-pmm-client-tarball'):
        let tarballURL = value.split("=")[1];
        await setup_pmm_client_tarball(tarballURL)
        break;
      default:
        break
    }
  }

  await setDefaulEnvVariables(parameters);

  for await (const [_index, value] of commandLineArgs.entries()) {
    const setup: SetupsInterface | undefined = availableSetups.find((setup) => setup.arg === value)
    if (setup) {
      await setup.function(parameters)
    }
  }
}

run();

export default run;
