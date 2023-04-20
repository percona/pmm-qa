import { executeCommand } from '../../helpers/commandLine';
import SetupParameters from '../../helpers/setupParameters.interface';
import {
  dockerNetworkName,
  pmmIntegrationClientName,
  pmmIntegrationDataName,
  pmmIntegrationServerName,
} from '../../integration-setup';

const addClientPs = async (parameters: SetupParameters, numberOfClients: number) => {
  console.log(`Installing ${numberOfClients} Percona Server with version ${parameters.psVersion}`);
  const timeStamp = Date.now();
  const ps_port: number = 43306;
  const ps_password = 'GRgrO9301RuF';

  await executeCommand(`sudo docker pull percona:${parameters.psVersion}`);
  // Start requested number of Percona Server containers
  for (let index = 0; index < numberOfClients; index++) {
    const containerName = `ps_integration_${timeStamp}_${index}`;

    if (parameters.querySource === 'slowlog') {
      if (parameters.ci) {
        await executeCommand(`sudo mkdir /var/log/${containerName}/`);
        await executeCommand(`sudo touch /var/log/${containerName}/ps_${index}_slowlog.log`);
        await executeCommand(`sudo chmod 777 /var/log/${containerName}/ps_${index}_slowlog.log`);
      } else {
        await executeCommand(`sudo docker exec -u 0 ${pmmIntegrationClientName} mkdir /var/log/${containerName}/`);
        await executeCommand(
          `sudo docker exec -u 0 ${pmmIntegrationClientName} touch /var/log/${containerName}/ps_${index}_slowlog.log`,
        );
        await executeCommand(
          `sudo docker exec -u 0 ${pmmIntegrationClientName} chmod 777 /var/log/${containerName}/ps_${index}_slowlog.log`,
        );
      }
    }

    let volumeLocation;

    if (parameters.ci) {
      volumeLocation = `/var/log/${containerName}/`;
    } else {
      volumeLocation = pmmIntegrationDataName;
    }

    await executeCommand(
      `sudo docker run -d --name ${containerName} -v ${volumeLocation}:/var/log/${containerName}/ -p ${ps_port + index
      }:3306 -e MYSQL_ROOT_PASSWORD=${ps_password} -e UMASK=0777 percona:${parameters.psVersion
      } --character-set-server=utf8 --default-authentication-plugin=mysql_native_password --collation-server=utf8_unicode_ci`,
    );
  }

  await executeCommand('sleep 30');

  for (let index = 0; index < numberOfClients; index++) {
    const containerName = `ps_integration_${timeStamp}_${index}`;

    await executeCommand(`sudo docker exec ${containerName} mysql -u root -p${ps_password} -e "SET GLOBAL userstat=1;"`);
    await executeCommand(
      `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e "SET GLOBAL innodb_monitor_enable=all;"`,
    );
    await executeCommand(
      `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e \
      "ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${ps_password}';"`,
    );
    if (parameters.querySource !== 'perfschema') {
      await executeCommand(
        `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e "SET GLOBAL slow_query_log='ON';"`,
      );
      await executeCommand(`sudo docker exec ${containerName} mysql -u root -p${ps_password} -e \
      "SET GLOBAL long_query_time=0;"`);
      await executeCommand(
        `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e \
        "SET GLOBAL log_slow_rate_limit=1;"`,
      );
      await executeCommand(
        `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e \
        "SET GLOBAL log_slow_admin_statements=ON;"`,
      );
      await executeCommand(
        `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e \
        "SET GLOBAL log_slow_slave_statements=ON;"`,
      );
      if (parameters.psVersion! < 8) {
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e \
          "INSTALL PLUGIN QUERY_RESPONSE_TIME_AUDIT SONAME 'query_response_time.so';"`,
        );
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e \
          "INSTALL PLUGIN QUERY_RESPONSE_TIME SONAME 'query_response_time.so';"`,
        );
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e \
          "INSTALL PLUGIN QUERY_RESPONSE_TIME_READ SONAME 'query_response_time.so';"`,
        );
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e \
          "INSTALL PLUGIN QUERY_RESPONSE_TIME_WRITE SONAME 'query_response_time.so';"`,
        );
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ps_password} -e "SET GLOBAL query_response_time_stats=ON;"`,
        );
      }

      await executeCommand(
        `sudo docker exec ${containerName} mysql -u root -p${ps_password} \
        -e "SET GLOBAL slow_query_log_file='/var/log/${containerName}/ps_${index}_slowlog.log';"`,
      );
      // Connect MySql to the PMM-Client with query source slowlog.
      await executeCommand(`sudo docker network connect ${dockerNetworkName} ${containerName}`);
      if (parameters.ci) {
        await executeCommand(
          `sudo pmm-admin add mysql --query-source=slowlog --size-slow-logs=1GiB --username=root \
          --password=${ps_password} ${containerName} --host=127.0.0.1 --port=${ps_port + index}`,
        );
      } else {
        await executeCommand(
          `sudo docker exec ${pmmIntegrationClientName} pmm-admin add mysql --query-source=slowlog \
          --size-slow-logs=1GiB --username=root --password=${ps_password} ${containerName} \
          --host=${containerName} --port=3306`,
        );
      }
    } else {
      // Connect MySql to the PMM-Client with query source perfschema.
      await executeCommand(`sudo docker network connect ${dockerNetworkName} ${containerName}`);
      if (parameters.ci) {
        await executeCommand(
          `sudo pmm-admin add mysql --query-source=perfschema --username=root --password=${ps_password} \
          ${containerName} --host=127.0.0.1 --port=${ps_port + index}`,
        );
      } else {
        await executeCommand(
          `sudo docker exec ${pmmIntegrationClientName} pmm-admin add mysql --query-source=perfschema \
          --username=root --password=${ps_password} ${containerName} --host=${containerName} --port=3306`,
        );
      }
    }
  }
};

export default addClientPs;
