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
    } else if(params.pmmClientVersion?.includes('2.')) {
        console.log('pmm client includes 2');
        await executeCommand('sudo apt list -a pmm2-client');
        await executeCommand(`sudo apt -y install pmm2-client=${params.pmmClientVersion}.0-6.jammy_amd64`);
        await executeCommand('sudo apt update');
        await executeCommand('sudo percona-release enable-only original experimental');
    }
};

export default SetupPMMClient;