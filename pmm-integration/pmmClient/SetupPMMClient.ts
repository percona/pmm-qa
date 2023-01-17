import { executeCommand } from "../helpers/commandLine";
import SetupParameters from "../helpers/setupParameters.interface";

const SetupPMMClient = async (params: SetupParameters) => {
    await executeCommand('sudo apt-get -y install https://repo.percona.com/yum/percona-release-latest.noarch.rpm || true')
    await executeCommand('sudo apt-get update')
    if(params.pmmClientVersion?.includes('dev-latest')) {
        await executeCommand('sudo percona-release enable-only original experimental');
        await executeCommand('sudo apt-get -y install pmm2-client');
        await executeCommand('sudo apt-get update')
    } else if(params.pmmClientVersion?.includes('pmm2-rc')) {
        await executeCommand('sudo percona-release enable-only original testing');
        await executeCommand('sudo apt-get -y install pmm2-client');
        await executeCommand('sudo apt-get update')
    } else if(params.pmmClientVersion?.includes('pmm2-latest')) {
        await executeCommand('sudo apt-get -y install pmm2-client');
        await executeCommand('sudo apt-get update')
        await executeCommand('sudo percona-release enable-only original experimental');
    } else if(params.pmmClientVersion?.includes('2.')) {
        await executeCommand(`sudo apt-get -y install pmm2-client-${params.pmmClientVersion}-6.el7.x86_64`);
        await executeCommand('sudo apt-get update')
        await executeCommand('sudo percona-release enable-only original experimental');
    }
};

export default SetupPMMClient;