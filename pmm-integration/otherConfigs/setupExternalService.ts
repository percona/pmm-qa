import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';
import { dockerNetworkName } from '../integration-setup';

const setupExternalService = async (parameters: SetupParameters) => {
  const nodeProcessExporterVersion = '0.7.5';
  const externalContainerName = 'external_nodeprocess';

  await executeCommand(`sudo docker run -d -p 42200:42200 --network="${dockerNetworkName}" \
  --name="${externalContainerName}" phusion/baseimage:focal-1.2.0`);

  await executeCommand(`sudo docker exec ${externalContainerName} apt update`);
  await executeCommand(`sudo docker exec ${externalContainerName} apt-get -y install wget`);

  await executeCommand(`sudo docker exec -u 0 ${externalContainerName} \
  wget https://github.com/oliver006/redis_exporter/releases/download/v1.14.0/redis_exporter-v1.14.0.linux-386.tar.gz`);

  await executeCommand(`sudo docker exec -u 0 ${externalContainerName} \
  tar -xvf redis_exporter-v1.14.0.linux-386.tar.gz`);

  await executeCommand(`sudo docker exec -u 0 ${externalContainerName} \
  rm redis_exporter*.tar.gz`);

  await executeCommand(`sudo docker exec -u 0 ${externalContainerName} \
  mv redis_* redis_exporter`);

  await executeCommand(`sudo docker run -d -p 6379:6379  --network="${dockerNetworkName}" \
  redis '--requirepass oFukiBRg7GujAJXq3tmd' --name="redis-container"`);

  await executeCommand(`sudo docker exec -u 0 ${externalContainerName} \
  bash -c './redis_exporter -redis.password=oFukiBRg7GujAJXq3tmd \
  -redis.addr=redis-container:6379 -web.listen-address=:42200 > redis.log 2>&1 &'`);
};

export default setupExternalService;
