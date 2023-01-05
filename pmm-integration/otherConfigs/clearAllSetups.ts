import { executeCommand } from "../helpers/commandLine";
import { stopAndRemoveContainer } from "../helpers/docker";
import os from 'os';
import { pmmIntegrationClientName, pmmIntegrationServerName } from "../integration-setup";

const clearAllSetups = async () => {
    await stopAndRemoveContainer('external_service_container');
    await stopAndRemoveContainer('redis_container');
    const runningContainers: string[] = (await executeCommand('sudo docker container ls -a --format "{{.Names}}"')).stdout.split(os.EOL);
    runningContainers.forEach(async (container) => {
        if(container.includes('ps_integration')) {
            await stopAndRemoveContainer(container);
        }
    });
    await stopAndRemoveContainer(pmmIntegrationClientName);
    await stopAndRemoveContainer(pmmIntegrationServerName);
};


export default clearAllSetups;