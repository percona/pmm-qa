import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';

const pmm2ClientLocalUpgrade = async (parameters: SetupParameters) => {
  let downloadUrl = '';

  if (parameters.upgradePmmClientVersion?.includes('http')) {
    downloadUrl = parameters.upgradePmmClientVersion;
  } else {
    // eslint-disable-next-line max-len
    downloadUrl = `https://downloads.percona.com/downloads/pmm2/${parameters.upgradePmmClientVersion}/binary/tarball/pmm2-client-${parameters.upgradePmmClientVersion}.tar.gz`;
  }

  if (parameters.upgradePmmClientVersion?.includes('experimental') || parameters.upgradePmmClientVersion?.includes('dev-latest')) {
    await executeCommand('sudo percona-release enable-only pmm2-client testing');
    await executeCommand('sudo apt-get update');
    await executeCommand('sudo apt -y install pmm2-client');
  } else if (parameters.upgradePmmClientVersion?.includes('testing') || parameters.upgradePmmClientVersion?.includes('pmm2-rc')) {
    await executeCommand('sudo percona-release enable-only pmm2-client experimental');
    await executeCommand('sudo apt-get update');
    await executeCommand('sudo apt -y install pmm2-client');
  } else if (parameters.upgradePmmClientVersion?.includes('pmm2-latest')) {
    await executeCommand('sudo apt-get update');
    await executeCommand('sudo apt -y install pmm2-client');
  } else {
    await executeCommand(`wget -O pmm2-client.tar.gz --progress=dot:giga ${downloadUrl}`);
    await executeCommand('tar -zxpf pmm2-client.tar.gz');
    await executeCommand('rm -r pmm2-client.tar.gz');
    const clientLocation = (await executeCommand('ls -1td pmm2-client* 2>/dev/null | grep -v ".tar" | grep -v ".sh" | head -n1')).stdout;

    await executeCommand(`mv ${clientLocation} pmm2-client`);
    await executeCommand('mv pmm2-client /usr/local/bin');
    await executeCommand('bash -x /usr/local/bin/pmm2-client/install_tarball -u');
    console.log(await executeCommand('pmm-admin --version'));
  }
};

export default pmm2ClientLocalUpgrade;
