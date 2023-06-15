import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';
import { dockerNetworkName, pmmIntegrationServerName, pmmServerVolume } from '../integration-setup';

const pmmServerSetup = async (parameters: SetupParameters) => {
  let portalVariables;

  if (!parameters.pmmServerVersions?.versionMinor || parameters.pmmServerVersions?.versionMinor >= 30) {
    portalVariables = '-e PERCONA_PORTAL_URL=https://portal-dev.percona.com -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443';
  } else {
    portalVariables = '-e PERCONA_TEST_SAAS_HOST=check-dev.percona.com -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443';
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

  await executeCommand(`sudo docker pull ${pmmServerDockerTag}`);
  await executeCommand(`sudo docker create --volume /srv --name ${pmmServerVolume} ${pmmServerDockerTag} /bin/true`);
  await executeCommand(
    `sudo docker run -d --restart always ${portalVariables} --network="${dockerNetworkName}" \
    -e PMM_DEBUG=1 -e PERCONA_TEST_PLATFORM_PUBLIC_KEY=RWTkF7Snv08FCboTne4djQfN5qbrLfAjb8SY3/wwEP+X5nUrkxCEvUDJ \
    --publish 80:80 --publish 443:443 --volumes-from ${pmmServerVolume} --name ${pmmIntegrationServerName} ${pmmServerDockerTag}`,
  );

  for (let i = 0; i <= 100; i++) {
    if (i === 100) {
      throw new Error('PMM Server was not properly started.');
    }

    const status = await executeCommand(`sudo docker ps -a --filter="name=${pmmIntegrationServerName}" --format="{{.Status}}"`);

    if (status.stdout.includes('healthy')) break;

    await new Promise((r) => setTimeout(r, 1000));
  }
};

export default pmmServerSetup;
