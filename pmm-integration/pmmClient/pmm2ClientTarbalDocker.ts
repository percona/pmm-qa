import { executeCommand } from '../helpers/commandLine';
import { stopAndRemoveContainer } from '../helpers/docker';
import SetupParameters from '../helpers/setupParameters.interface';
import { dockerNetworkName, pmmIntegrationClientName, pmmIntegrationDataMongoVolume, pmmIntegrationServerName } from '../integration-setup';

const setup_pmm_client_docker_tarball = async (parameters: SetupParameters) => {
  const containerName = pmmIntegrationClientName;

  await executeCommand(
    `sudo docker run -d --network="${dockerNetworkName}" \
    -v ${pmmIntegrationDataMongoVolume}:/tmp/ \
    --name=${containerName} phusion/baseimage:focal-1.2.0`,
  );

  await executeCommand(`sudo docker exec ${containerName} apt update`);
  await executeCommand(`sudo docker exec ${containerName} apt-get -y install wget`);
  await executeCommand(`sudo docker exec ${containerName} \
    wget https://raw.githubusercontent.com/percona/pmm-qa/main/pmm-tests/pmm2-client-setup.sh`);
  await executeCommand(`sudo docker exec ${containerName} bash -x ./pmm2-client-setup.sh \
    --pmm_server_ip ${pmmIntegrationServerName} \
    --client_version ${parameters.pmmClientVersion} \
    --admin_password admin \
    --use_metrics_mode no
  `);
  await executeCommand('sleep 30');
};

export default setup_pmm_client_docker_tarball;
