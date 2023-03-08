import { executeCommand } from '../../helpers/commandLine';
import SetupParameters from '../../helpers/setupParameters.interface';
import {
  dockerNetworkName,
  pmmIntegrationClientName,
  pmmIntegrationServerName,
} from '../../integration-setup';

const instalHaproxy = async (parameters: SetupParameters) => {
  console.log(`Installing HAProxy's with version ${parameters.haproxyVersion}`);
  const containerName = 'haproxy-integration';
  // const prefix = parameters.ci ? 'sudo ' : `sudo docker exec ${pmmIntegrationClientName} `;

  await executeCommand(`sudo docker pull haproxy:${parameters.haproxyVersion}`);
  await executeCommand(
    `sudo docker run -d \
    --network="${dockerNetworkName}" \
    -v $PWD/otherConfigs/haproxy:/usr/local/etc/haproxy:ro \
    --name ${containerName} haproxy:${parameters.haproxyVersion} `
  );
  await executeCommand(`sudo docker cp ../pmm-tests/pmm2-client-setup.sh ${containerName}:/`);
  await executeCommand(
    `sudo docker exec  ${containerName} bash -x /pmm2-client-setup.sh --pmm_server_ip ${pmmIntegrationServerName} --client_version ${parameters.pmmClientVersion} --admin_password admin --use_metrics_mode no`
  );
  await executeCommand('sudo pmm-admin status');

  await executeCommand(
    `sudo pmm-admin add haproxy --listen-port=42100 --environment=haproxy ${containerName}_service`
  );
};

export default instalHaproxy;
