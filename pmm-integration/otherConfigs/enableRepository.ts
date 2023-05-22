import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';
import { pmmIntegrationClientName, pmmIntegrationServerName } from '../integration-setup';

export const enableTestingRepository = async (parameters: SetupParameters) => {
  await executeCommand(`sudo docker exec ${pmmIntegrationServerName} \
  bash -c "echo exclude=mirror.es.its.nyu.edu | tee -a /etc/yum/pluginconf.d/fastestmirror.conf"`)
  await executeCommand(`sudo docker exec ${pmmIntegrationServerName} yum update -y percona-release`);
  await executeCommand(`sudo docker exec ${pmmIntegrationServerName} \
  sed -i'' -e 's^/release/^/testing/^' /etc/yum.repos.d/pmm2-server.repo`);
  await executeCommand(`sudo docker exec ${pmmIntegrationServerName} percona-release enable-only percona testing`);
  // eslint-disable-next-line no-useless-concat
  // await executeCommand(parameters.ci ? 'sudo' : `sudo docker exec  ${pmmIntegrationClientName}` + ' percona-release enable-only percona testing');
};
