import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';
import { dockerNetworkName, pmmIntegrationServerName } from '../integration-setup';

const addClientHaProxy = async (parameters: SetupParameters, numberOfClients: number) => {
  console.log(`Installing ${numberOfClients} HaProxy database(s).`);

  for (let index = 0; index < numberOfClients; index++) {
    const containerName = `haproxy-${index}`;
    const port = 42100 + index;

    await executeCommand(`sudo docker run -d -p ${port}:42100 --network="${dockerNetworkName}" \
    --name="${containerName}" phusion/baseimage:focal-1.2.0`);
    await executeCommand(`sudo docker exec -u 0 ${containerName} apt-get update`);
    await executeCommand(`sudo docker exec -u 0 ${containerName} apt-get -y install wget curl git gnupg2 lsb-release`);
    await executeCommand(`sudo docker exec -u 0 ${containerName} apt-get -y install -y git ca-certificates gcc \
    libc6-dev liblua5.3-dev libpcre3-dev libssl-dev libsystemd-dev make wget zlib1g-dev`);
    await executeCommand(`sudo docker exec -u 0 ${containerName} git clone https://github.com/haproxy/haproxy.git`);
    await executeCommand(`sudo docker exec -u 0 ${containerName} bash -c 'cd haproxy && \
    make TARGET=linux-glibc USE_LUA=1 USE_OPENSSL=1 USE_PCRE=1 USE_ZLIB=1 USE_SYSTEMD=1 USE_PROMEX=1 && make install-bin'`);
    await executeCommand(`sudo docker exec -u 0 ${containerName} cp /usr/local/sbin/haproxy /usr/sbin/haproxy`);

    await executeCommand(`sudo docker exec ${containerName} \
    wget https://raw.githubusercontent.com/percona/pmm-qa/main/pmm-tests/pmm2-client-setup.sh`);
    await executeCommand(`sudo docker exec ${containerName} bash -x 
    ./pmm2-client-setup.sh --pmm_server_ip ${pmmIntegrationServerName} --client_version ${parameters.pmmClientVersion} \
    --admin_password admin --use_metrics_mode no`);

    await executeCommand(`sudo docker cp ./haProxy/haproxy.cfg ${containerName}:/`);

    await executeCommand('sleep 60');
    await executeCommand(`sudo docker exec ${containerName} haproxy -f haproxy.cfg -D`);
    await executeCommand(`sudo docker exec ${containerName} bash -c 'source ~/.bash_profile || true; pmm-admin add haproxy \
    --listen-port=42100 --environment=haproxy ${containerName}_service'`);
  }
};

export default addClientHaProxy;
