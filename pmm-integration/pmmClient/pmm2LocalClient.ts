import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';

const pmm2ClientLocalSetup = async (parameters: SetupParameters) => {
  await executeCommand('sudo apt-get update');
  await executeCommand('sudo apt-get install -y wget gnupg2 libtinfo-dev libnuma-dev mysql-client postgresql-client');
  await executeCommand('wget https://repo.percona.com/apt/percona-release_latest.$(lsb_release -sc)_all.deb');
  await executeCommand('sudo dpkg -i percona-release_latest.$(lsb_release -sc)_all.deb');
  await executeCommand('sudo apt-get update');
  await executeCommand(`wget -O pmm2-client.tar.gz --progress=dot:giga "${parameters.pmmClientVersion}"`);
  await executeCommand('tar -zxpf pmm2-client.tar.gz');
  await executeCommand('rm -r pmm2-client.tar.gz');
  const clientLocation = (await executeCommand('ls -1td pmm2-client* 2>/dev/null | grep -v ".tar" | grep -v ".sh" | head -n1')).stdout;

  console.log(`Client location is: ${clientLocation}`);
  await executeCommand(`mv ${clientLocation} pmm2-client`);
  await executeCommand('mv pmm2-client /usr/local/bin');
  await executeCommand('pushd /usr/local/bin/pmm2-client');
  await executeCommand('bash -x ./install_tarball');
  console.log(await executeCommand('pmm-admin --version'));
  const pmmServerPassword = parameters.pmmServerPassword || 'admin';
  const pmmServerIp = parameters.pmmServerIp || '127.0.0.1';

  if (parameters.metricsMode) {
    await executeCommand(`pmm-agent setup --config-file=/usr/local/config/pmm-agent.yaml \
    --server-address=${pmmServerIp}:443 --server-insecure-tls \
    --metrics-mode=${parameters.metricsMode} --server-username=admin --server-password=${pmmServerPassword}`);
  }
};

export default pmm2ClientLocalSetup;
