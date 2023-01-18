import { executeCommand } from "../helpers/commandLine";
import SetupParameters from "../helpers/setupParameters.interface";

const SetupPMMClient = async (params: SetupParameters) => {
    await executeCommand('sudo wget https://repo.percona.com/apt/percona-release_latest.generic_all.deb');
    await executeCommand('sudo dpkg -i percona-release_latest.generic_all.deb');
    await executeCommand('sudo apt update');
    if(params.pmmClientVersion?.includes('dev-latest')) {
        await executeCommand('sudo percona-release enable-only original experimental');
        await executeCommand('sudo apt update');
        await executeCommand('sudo apt install -y pmm2-client');
    } else if(params.pmmClientVersion?.includes('pmm2-rc')) {
        await executeCommand('sudo percona-release enable-only original testing');
        await executeCommand('sudo apt update');
        await executeCommand('sudo apt -y install pmm2-client');
    } else if(params.pmmClientVersion?.includes('pmm2-latest')) {
        await executeCommand('sudo apt -y install pmm2-client');
        await executeCommand('sudo apt update');
        await executeCommand('sudo percona-release enable-only original experimental');
    } else if(params.pmmClientVersion?.includes('2.') && !params.pmmClientVersion?.includes('http')) {
        await executeCommand(`wget https://downloads.percona.com/downloads/pmm2/${params.pmmClientVersion}/binary/debian/jammy/x86_64/pmm2-client_${params.pmmClientVersion}-6.jammy_amd64.deb`);
        await executeCommand(`sudo dpkg -i pmm2-client_${params.pmmClientVersion}-6.jammy_amd64.deb`);
        await executeCommand('sudo apt update');
        await executeCommand('sudo percona-release enable-only original experimental');
    } else if(params.pmmClientVersion?.includes('http')) {
        console.log('pmm client contains address.')
        await executeCommand('sudo apt list -a pmm2-client');
        await executeCommand(`sudo wget -O pmm2-client.tar.gz --progress=dot:giga "${params.pmmClientVersion}"`);
        await executeCommand(`sudo tar -zxpf pmm2-client.tar.gz`);
        await executeCommand(`sudo rm -r pmm2-client.tar.gz`);
        await executeCommand(`sudo mv pmm2-client-* pmm2-client`);
        await executeCommand(`sudo bash -x ./pmm2-client/install_tarball`);
        await executeCommand(`sudo echo "$(pwd)/pmm2-client/bin"`);
        // await executeCommand(`echo "$(pwd)/pmm2-client/bin" >> $(GITHUB_PATH)`);
        // await executeCommand(`sudo echo $PATH`);
        await executeCommand('pmm-admin --version');
        await executeCommand('sudo apt update');
        await executeCommand('sudo percona-release enable-only original experimental');
    }
/*



pwd
cd ../
export PMM_CLIENT_BASEDIR=`ls -1td pmm2-client 2>/dev/null | grep -v ".tar" | head -n1`
export PATH="`pwd`/pmm2-client/bin:\$PATH"
echo "export PATH=`pwd`/pmm2-client/bin:\$PATH" >> ~/.bash_profile
source ~/.bash_profile
pmm-admin --version
*/
};

export default SetupPMMClient;