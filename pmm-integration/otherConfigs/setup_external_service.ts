import SetupParameters from "../helpers/setupParameters.interface";
import { executeCommand, executeCommandIgnoreErrors, setEnvVariable } from "../helpers/commandLine";
import { dockerNetworkName, pmmIntegrationServerName } from '../integration-setup'
import { connectPmmClient, installPmmClient, stopAndRemoveContainer } from "../helpers/docker";

const setup_external_service = async (parameters: SetupParameters) => {
    const externalServiceContainerName = 'external_service_container';
    const nodeProcessExporterVersion = '0.7.5';

    await stopAndRemoveContainer(externalServiceContainerName);
    await stopAndRemoveContainer('redis_container');

    await executeCommand(`docker run -d --network=${dockerNetworkName} --name=${externalServiceContainerName} phusion/baseimage:focal-1.2.0`);
    await executeCommand(`docker exec ${externalServiceContainerName} apt-get update -y`);
    await executeCommand(`docker exec ${externalServiceContainerName} apt-get install wget -y`);

    await installPmmClient(externalServiceContainerName);
    await connectPmmClient(externalServiceContainerName, `${pmmIntegrationServerName}:443`);
    await executeCommandIgnoreErrors(`docker exec ${externalServiceContainerName} rm redis_exporter*.tar.gz`);
    await executeCommand(`docker exec ${externalServiceContainerName} wget https://github.com/oliver006/redis_exporter/releases/download/v1.14.0/redis_exporter-v1.14.0.linux-386.tar.gz`);
    await executeCommand(`docker exec ${externalServiceContainerName} tar -xvf redis_exporter-v1.14.0.linux-386.tar.gz`);
    await executeCommand(`docker exec ${externalServiceContainerName} mv redis_exporter-v1.14.0.linux-386 redis_exporter`);
    await executeCommand(`docker exec -i ${externalServiceContainerName} bash -c cd redis_exporter`);
    await executeCommand(`docker run -d -p 6379:6379 --network=${dockerNetworkName} --name=redis_container redis '--requirepass oFukiBRg7GujAJXq3tmd'`);
    await executeCommand(`docker exec ${externalServiceContainerName} bash -c "./redis_exporter -redis.password=oFukiBRg7GujAJXq3tmd -redis.addr=redis_container:6379 -web.listen-address=:42200 > redis.log 2>&1 &"`);

    await new Promise(r => setTimeout(r, 10000));
    await executeCommand(`docker exec ${externalServiceContainerName} pmm-admin --version`);
    await executeCommand(`sudo docker exec ${externalServiceContainerName} pmm-admin add external --server-url=https://${pmmIntegrationServerName}:443 --listen-port=42200 --group="redis" --service-name="redis_external"`);
// pmm-agent setup --config-file=/usr/local/percona/pmm2/config/pmm-agent.yaml --server-address=pmm-integration-server:443 --server-insecure-tls --server-username=admin --server-password=admin

}

export default setup_external_service;

