import { executeCommand } from '../helpers/commandLine';

const installDockerCompose = async () => {
  await executeCommand(
    'sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
  );
  await executeCommand('sudo chmod +x /usr/local/bin/docker-compose');
  await executeCommand('sudo docker-compose --version');
};

export default installDockerCompose;
