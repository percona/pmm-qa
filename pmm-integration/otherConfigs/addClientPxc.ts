import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';
import { dockerNetworkName, pmmIntegrationServerName } from '../integration-setup';

const addClientPxc = async (parameters: SetupParameters, numberOfClients: number) => {
  console.log(`Installing ${numberOfClients} Percona XtraDB Cluster with version ${parameters.versions?.pxcVersion}`);

  const pxcVersions = new Map<number, string>([
    [8, 'https://downloads.percona.com/downloads/Percona-XtraDB-Cluster-LATEST/Percona-XtraDB-Cluster-8.0.29/binary/tarball/Percona-XtraDB-Cluster_8.0.29-21.1_Linux.x86_64.glibc2.17-minimal.tar.gz'],
    [5.7, 'https://downloads.percona.com/downloads/Percona-XtraDB-Cluster-57/Percona-XtraDB-Cluster-5.7.39-31.61/binary/tarball/Percona-XtraDB-Cluster-5.7.39-rel42-61.1.Linux.x86_64.glibc2.12-minimal.tar.gz'],
  ]);
  const pxcTarbalVersion = pxcVersions.get(parameters.versions.pxcVersion || 8);

  for (let index = 0; index < numberOfClients; index++) {
    const containerName = `pxc-${index}`;

    await executeCommand(`sudo docker run -d --network="${dockerNetworkName}" \
    --name="${containerName}" phusion/baseimage:focal-1.2.0`);
    await executeCommand(`sudo docker exec ${containerName} mkdir -p artifacts`);
    await executeCommand(`sudo docker cp ../pmm-tests/client_container_pxc_proxysql_setup.sh ${containerName}:/`);

    // Install Missing dependencies
    await executeCommand(`sudo docker exec ${containerName} apt-get update`);
    await executeCommand(`sudo docker exec ${containerName} apt-get -y install wget curl git gnupg2 lsb-release`);
    await executeCommand(`sudo docker exec ${containerName} apt-get -y install libaio1 libaio-dev libnuma-dev socat`);

    // Create User
    await executeCommand(`sudo docker exec ${containerName} adduser --disabled-password --gecos "" pxc`);

    // Install ProxySql
    await executeCommand(`sudo docker exec ${containerName}  
    wget https://github.com/sysown/proxysql/releases/download/v2.4.4/proxysql_2.4.4-dbg-ubuntu20_amd64.deb`);
    await executeCommand(`sudo docker exec ${containerName} dpkg -i proxysql_2.4.4-dbg-ubuntu20_amd64.deb`);
    await executeCommand(`sudo docker exec ${containerName} apt install -y sysbench`);

    // Install pmm-client
    await executeCommand(`sudo docker exec ${containerName} \
    wget https://raw.githubusercontent.com/percona/pmm-qa/main/pmm-tests/pmm2-client-setup.sh`);
    await executeCommand(`sudo docker exec ${containerName} bash -x 
    ./pmm2-client-setup.sh --pmm_server_ip ${pmmIntegrationServerName} --client_version ${parameters.pmmClientVersion} \
    --admin_password admin --use_metrics_mode no`);

    // Enable release repo and install percona xtrabackup
    if (parameters.versions.pxcVersion! < 8.0) {
      await executeCommand(`sudo docker exec ${containerName} percona-release enable-only tools release`);
      await executeCommand(`sudo docker exec ${containerName} apt-get update`);
      await executeCommand(`sudo docker exec ${containerName} apt-get install -y percona-xtrabackup-24`);
    }

    await executeCommand(`sudo docker exec --user pxc ${containerName} bash -xe ./client_container_pxc_proxysql_setup.sh 
    --pxc_version ${parameters.versions.pxcVersion} --pxc_tarball ${pxcTarbalVersion} 
    --number_of_nodes 3
    --pxc_dev_cluster pxc-dev-cluster`);

    // Start ProxySQL inside the PXC extra_pxc_container
    await executeCommand(`sudo docker exec ${containerName} sed -i "s/3306/$(cat /home/pxc/PXC/node1.cnf | grep port 
    | awk -F"=" '{print $2}')/" /etc/proxysql.cnf`);
    await executeCommand(`sudo docker exec ${containerName} proxysql -c /etc/proxysql.cnf`);
    await executeCommand(`sudo docker exec ${containerName} sleep 20`);
    await executeCommand(`sudo docker exec ${containerName} pmm-admin add proxysql --environment=proxysql-dev 
    --cluster=proxysql-dev-cluster --replication-set=proxysql-repl`);
  }
};

export default addClientPxc;
