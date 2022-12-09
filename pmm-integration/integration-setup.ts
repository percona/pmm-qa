import validateArgs from "./helpers/validateArgs";
import { executeCommand, installAnsible, setDefaultEnvVariables, setEnvVariable } from "./helpers/commandLine";
import { availableSetups, SetupsInterface } from "./availableArgs";
import setup_pmm_client_tarball from "./pmmClient/pmm2ClientTarbal";
import { recreateNetwork, stopAndRemoveContainer } from "./helpers/docker";
import SetupParameters from "./helpers/setupParameters.interface";
import * as core from '@actions/core';
import * as dotenv from 'dotenv'

export const dockerNetworkName = "pmm-integration-network"
export const pmmIntegrationServerName = 'pmm-integration-server'
dotenv.config()

const run = async () => {
  let parameters: SetupParameters = {};
  const commandLineArgs: string[] = process.argv.slice(2);

  if(process.env.CI) {
    await installAnsible();
  } else {
    await recreateNetwork(dockerNetworkName);
    await stopAndRemoveContainer(pmmIntegrationServerName);
    await executeCommand(`docker run -d --restart always -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443 --network="${dockerNetworkName}" --publish 8080:80 --publish 8443:443 --name ${pmmIntegrationServerName} percona/pmm-server:latest`);
  }

  validateArgs(commandLineArgs);

  for await (const [_index, value] of commandLineArgs.entries()) {
    switch (true) {
      case value.includes('--pgsql-version'):
        parameters.pgsqlVersion = value.split("=")[1];
        await setEnvVariable('PGSQL_VERSION', parameters.pgsqlVersion);
        break
      case value.includes('--mo-version'):
        parameters.moVersion = value.split("=")[1];
        await setEnvVariable('MO_VERSION', parameters.moVersion);
        break
      case value.includes('--ps-version'):
          parameters.psVersion = value.split("=")[1];
          await setEnvVariable('PS_VERSION', parameters.psVersion);
          break
      case value.includes('--setup-pmm-client-tarball'):
        let tarballURL = value.split("=")[1];
        await setup_pmm_client_tarball(tarballURL)
        break;
      default:
        break
    }
  }

  await setDefaultEnvVariables(parameters);

  for await (const [_index, value] of commandLineArgs.entries()) {
    const setup: SetupsInterface | undefined = availableSetups.find((setup) => setup.arg === value)
    if (setup) {
      await setup.function(parameters)
    }
  }
}

run();

export default run;
