import SetupParameters from "../helpers/setupParameters.interface";
import { executeCommand, executeCommandIgnoreErrors, setEnvVariable } from "../helpers/commandLine";
import { dockerNetworkName, pmmIntegrationServerName } from '../integration-setup'
import { connectPmmClient, installPmmClient, stopAndRemoveContainer } from "../helpers/docker";

const setup_external_service = async (parameters: SetupParameters) => {
    const externalServiceContainerName = 'external_service_container';
    const nodeProcessExporterVersion = '0.7.5';
    

    await stopAndRemoveContainer(externalServiceContainerName);
    await stopAndRemoveContainer('redis_container');

    // await executeCommand(`docker run  -d -p 42200:42200 --network=${dockerNetworkName} --name=${externalServiceContainerName} phusion/baseimage:focal-1.2.0`);
    // await executeCommand(`docker run  -d -p 42200:42200 --network=${dockerNetworkName} --name=${externalServiceContainerName} jrei/systemd-ubuntu:22.04`);
    
    await executeCommand(`sudo apt-get update`);
    await executeCommand(`sudo apt-get install wget`);
    await executeCommand(`wget https://github.com/oliver006/redis_exporter/releases/download/v1.14.0/redis_exporter-v1.14.0.linux-386.tar.gz`);

    await executeCommand(`sudo tar -xvf redis_exporter-v1.14.0.linux-386.tar.gz`);

    await executeCommand(`sudo mv redis_exporter-v1.14.0.linux-386 redis_exporter`);

    await executeCommand(`sudo docker run -d -p 6379:6379 --network=${dockerNetworkName} --name=redis_container redis '--requirepass oFukiBRg7GujAJXq3tmd'`);

    await executeCommand(`touch redis.log`);

    await executeCommand(`./redis_exporter/redis_exporter -redis.password=oFukiBRg7GujAJXq3tmd -redis.addr=localhost:6379 -web.listen-address=:42200 > redis.log 2>&1 &`);

    await executeCommand(`wget https://raw.githubusercontent.com/percona/pmm-qa/main/pmm-tests/pmm2-client-setup.sh`);
    await executeCommand(`bash -x ./pmm2-client-setup.sh --pmm_server_ip ${pmmIntegrationServerName} --client_version ${parameters.pmmClientVersion} --admin_password admin --use_metrics_mode no`);

    await executeCommand(`sleep 10`);
    
    await executeCommand(`pmm-admin add external --listen-port=42200 --group="redis" --service-name="redis_external"`);

    await executeCommand(`wget https://github.com/ncabatoff/process-exporter/releases/download/v${nodeProcessExporterVersion}/process-exporter_${nodeProcessExporterVersion}_linux_amd64.deb`);
    await executeCommand(`sudo dpkg -i process-exporter_${nodeProcessExporterVersion}_linux_amd64.deb`);
    await executeCommand(`sudo service process-exporter start`);
    
    await executeCommand(`sleep 10`);
}

export default setup_external_service;

