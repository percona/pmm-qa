import validateArgs from './helpers/validateArgs';
import { executeCommand, executeCommandIgnoreErrors, setDefaultEnvVariables } from './helpers/commandLine';
import { availableSetups, SetupsInterface } from './availableArgs';
import { recreateNetwork, stopAndRemoveContainer } from './helpers/docker';
import SetupParameters from './helpers/setupParameters.interface';
import pmmServerSetup from './pmmServer/pmmServerSetup';
import setup_pmm_client_docker_tarball from './pmmClient/pmm2ClientTarbalDocker';
import pmm2ClientLocalUpgrade from './pmmClient/pmm2LocalClientUpgrade';

export const dockerNetworkName = 'pmm-integration-network';
export const pmmIntegrationClientName = 'pmm-integration-client';
export const pmmIntegrationServerName = 'pmm-integration-server';
export const pmmServerVolume = 'pmm-integration-server-data';
export const pmmIntegrationDataName = 'pmm-integration-data';
export const pmmIntegrationDataMongoVolume = 'pmm-integration-mongo-data';

const run = async () => {
  const parameters: SetupParameters = { versions: {} };
  const commandLineArgs: string[] = process.argv.slice(2);

  validateArgs(commandLineArgs);

  // eslint-disable-next-line no-restricted-syntax
  for await (const [_index, value] of commandLineArgs.entries()) {
    switch (true) {
      case value.includes('--pgsql-version'):
        parameters.pgsqlVersion = value.split('=')[1];
        break;
      case value.includes('--pdpgsql-version'):
        parameters.pdpgsqlVersion = value.split('=')[1];
        break;
      case value.includes('--mo-version'):
        parameters.moVersion = value.split('=')[1];
        break;
      case value.includes('--mo-setup'):
        parameters.moSetup = value.split('=')[1];
        break;
      case value.includes('--psmo-version'):
        parameters.versions.psMoVersion = value.split('=')[1];
        break;
      case value.includes('--ps-version'):
        parameters.psVersion = parseFloat(value.split('=')[1]);
        break;
      case value.includes('--pmm-client-version'):
        parameters.pmmClientVersion = value.split('=')[1];
        break;
      case value.includes('--upgrade-pmm-client-version'):
        parameters.upgradePmmClientVersion = value.split('=')[1];
        await pmm2ClientLocalUpgrade(parameters);
        break;
      case value.includes('--pmm-server-version'):
        const pmmServerVersion = value.split('=')[1];

        if (pmmServerVersion.length > 0) {
          parameters.pmmServerVersions = {
            versionMajor: parseInt(pmmServerVersion.split('.')[0], 10),
            versionMinor: parseInt(pmmServerVersion.split('.')[1], 10),
            versionPatch: parseInt(pmmServerVersion.split('.')[2], 10),
          };
        }

        parameters.pmmServerVersion = value.split('=')[1];
        break;
      case value.includes('--query-source'):
        parameters.querySource = value.split('=')[1];
        break;
      case value.includes('--ci'):
        parameters.ci = true;
        break;
      case value.includes('--use-socket'):
        parameters.useSocket = true;
        break;
      case value.includes('--rbac'):
        parameters.rbac = true;
        break;
      case value.includes('--pmm-server-docker-tag'):
        parameters.pmmServerDockerTag = value.split('=')[1];
        break;
      case value.includes('--setup-tarball-docker'):
        parameters.setupTarballDocker = true;
        break;
      case value.includes('--pxc-version'):
        parameters.versions.pxcVersion = parseFloat(value.split('=')[1]);
        break;
      default:
        break;
    }
  }

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

  // eslint-disable-next-line no-restricted-syntax
  for await (const [_index, value] of commandLineArgs.entries()) {
    const setup: SetupsInterface | undefined = availableSetups.find((setup) => value.includes(setup.arg));

    if (setup) {
      await setup.function(parameters, value);
    }
  }
};

run();

export default run;
