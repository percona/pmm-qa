import validateArgs from './helpers/validateArgs';
import { executeCommand, executeCommandIgnoreErrors, setDefaultEnvVariables } from './helpers/commandLine';
import { availableSetups, SetupsInterface } from './availableArgs';
import { recreateNetwork, stopAndRemoveContainer } from './helpers/docker';
import SetupParameters from './helpers/setupParameters.interface';
import pmmServerSetup from './pmmServer/pmmServerSetup';
import setup_pmm_client_docker_tarball from './pmmClient/pmm2ClientTarbalDocker';
import parseFlags from './helpers/parseFlags';

export const dockerNetworkName = 'pmm-integration-network';
export const pmmIntegrationClientName = 'pmm-integration-client';
export const pmmIntegrationServerName = 'pmm-integration-server';
export const pmmIntegrationDataName = 'pmm-integration-data';
export const pmmIntegrationDataMongoVolume = 'pmm-integration-mongo-data';

const run = async () => {
  const parameters: SetupParameters = { versions: {} };
  const commandLineArgs: string[] = process.argv.slice(2);

  await validateArgs(commandLineArgs);
  await parseFlags(commandLineArgs, parameters);
  await setDefaultEnvVariables(parameters);

  if (!commandLineArgs.includes('--clear-all-setups')) {
    await recreateNetwork(dockerNetworkName);
    if (!parameters.ci) {
      await executeCommandIgnoreErrors(`sudo docker volume rm ${pmmIntegrationDataName}`);
      await executeCommandIgnoreErrors(`sudo docker volume rm ${pmmIntegrationDataMongoVolume}`);
      await stopAndRemoveContainer(pmmIntegrationServerName);
      await stopAndRemoveContainer(pmmIntegrationClientName);
      await executeCommand(`sudo docker volume create ${pmmIntegrationDataName}`);
      await executeCommand(`sudo docker volume create ${pmmIntegrationDataMongoVolume}`);
      await pmmServerSetup(parameters);
      if (!parameters.setupTarballDocker) {
        await executeCommand(
          `sudo docker run -d --name ${pmmIntegrationClientName} \
          -v ${pmmIntegrationDataName}:/var/log/ -v ${pmmIntegrationDataMongoVolume}:/tmp/ \
          --network="${dockerNetworkName}" -e PMM_AGENT_SERVER_ADDRESS=${pmmIntegrationServerName} \
          -e PMM_AGENT_SERVER_USERNAME=admin -e PMM_AGENT_SERVER_PASSWORD=admin -e PMM_AGENT_SERVER_INSECURE_TLS=1 \
          -e PMM_AGENT_SETUP=1 \
          -e PMM_AGENT_CONFIG_FILE=config/pmm-agent.yaml perconalab/pmm-client:${parameters.pmmClientVersion}`,
        );
      } else {
        await setup_pmm_client_docker_tarball(parameters);
      }
    }
  }

  const promises = [];

  // eslint-disable-next-line no-restricted-syntax
  for await (const [_index, value] of commandLineArgs.entries()) {
    const setup: SetupsInterface | undefined = availableSetups.find((setup) => value.includes(setup.arg));

    if (setup) {
      promises.push(setup.function(parameters, value));
    }
  }

  await Promise.all(promises);
};

run();

export default run;
