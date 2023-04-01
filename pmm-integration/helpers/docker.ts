import { executeCommand, executeCommandIgnoreErrors } from './commandLine';

export const stopAndRemoveContainer = async (containerName: string) => {
  await executeCommandIgnoreErrors(`sudo docker stop ${containerName}`);
  await executeCommandIgnoreErrors(`sudo docker rm ${containerName}`);
};

export const recreateNetwork = async (networkName: string) => {
  await executeCommandIgnoreErrors(`sudo docker network rm ${networkName}`);
  await executeCommandIgnoreErrors(`sudo docker network create ${networkName}`);
};

export const installPmmClient = async (containerName: string) => {
  // Only works on debian based containers!
  await executeCommand(
    `sudo docker exec ${containerName} wget https://repo.percona.com/apt/percona-release_latest.$(lsb_release -sc)_all.deb`,
  );
  await executeCommand(`sudo docker exec ${containerName} dpkg -i percona-release_latest.$(lsb_release -sc)_all.deb`);
  await executeCommand(`sudo docker exec ${containerName} apt-get update`);
  await executeCommand(`sudo docker exec ${containerName} apt-get install pmm2-client`);
  await executeCommand(`sudo docker exec -i ${containerName} bash -c "pmm-admin --version"`);
};

export const connectPmmClient = async (
  containerName: string,
  serverAddress: string,
  username: string = 'admin',
  password: string = 'admin',
) => {
  await executeCommand(
    `sudo docker exec ${containerName} pmm-agent setup --config-file=/usr/local/percona/pmm2/config/pmm-agent.yaml \
     --server-address=${serverAddress} --server-insecure-tls --server-username=${username} --server-password=${password}`,
  );
};
