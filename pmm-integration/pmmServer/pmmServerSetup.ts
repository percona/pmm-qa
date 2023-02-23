import { executeCommand } from "../helpers/commandLine";
import SetupParameters from "../helpers/setupParameters.interface";
import { dockerNetworkName, pmmIntegrationServerName } from "../integration-setup";

const pmmServerSetup = async (parameters: SetupParameters) => {
    let portalVariables;
    if(!parameters.pmmServerVersions?.versionMinor || parameters.pmmServerVersions?.versionMinor >= 30) {
      portalVariables = '-e PERCONA_PORTAL_URL=https://portal-dev.percona.com -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443'
    } else {
      portalVariables = '-e PERCONA_TEST_SAAS_HOST=check-dev.percona.com -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443'
    }

    if (parameters.rbac) {
      portalVariables += ' -e ENABLE_RBAC=1';
    }

    let pmmServerDockerTag;

    if (parameters.pmmServerDockerTag) {
      pmmServerDockerTag = parameters.pmmServerDockerTag;
    } else {
      pmmServerDockerTag = `perconalab/pmm-server:${parameters.pmmServerVersion}`;
    }

    await executeCommand(`docker run -d --restart always ${portalVariables} --network="${dockerNetworkName}" --publish 80:80 --publish 443:443 --name ${pmmIntegrationServerName} ${pmmServerDockerTag}`);
}

export default pmmServerSetup