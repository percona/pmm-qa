import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';

const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const postgresImage = process.env.POSTGRES_IMAGE || 'perconalab/percona-distribution-postgresql:17';
const workDir = path.join(os.tmpdir(), 'external-postgres');
const dataDir = `${workDir}/data`;
const sslDir = `${workDir}/ssl`;
const sslConfig = 'testdata/external-pgsql-ssl-config.cnf';

export default class ExternalPostgresHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  removeAll = () => {
    for (const container of [
      'external-postgres',
      'pmm-server-external-postgres',
      'external-postgres-ssl',
      'pmm-server-external-postgres-ssl',
    ]) {
      this.cliHelper.removeContainer(container);
    }

    this.cliHelper
      .execSilent('docker volume rm -f pmm-server-external-pg pmm-server-external-pg-ssl')
      .assertSuccess();
    this.cliHelper.execSilent(`sudo rm -rf ${workDir}`).assertSuccess();
  };

  startPmmServer = async (postgresContainer: string, ssl: boolean) => {
    const pmmContainer = `pmm-server-${postgresContainer}`;

    this.cliHelper
      .execute(
        `docker run -d --name ${pmmContainer} --restart always --network=pmm-qa -p 8082:8080 -p 8447:8443
          -e PMM_POSTGRES_DBNAME=grafana -e PMM_POSTGRES_ADDR=${postgresContainer}:5432
          -e PMM_POSTGRES_USERNAME=postgres -e PMM_POSTGRES_DBPASSWORD=pmm_password
          -e PMM_DISABLE_BUILTIN_POSTGRES=1
          ${ssl ? '-e PMM_POSTGRES_SSL_MODE=verify-ca -e PMM_POSTGRES_SSL_CA_PATH=/etc/ssl/postgresql/ca.crt -e PMM_POSTGRES_SSL_KEY_PATH=/etc/ssl/postgresql/client.key -e PMM_POSTGRES_SSL_CERT_PATH=/etc/ssl/postgresql/client.crt' : ''}
          -e GF_DATABASE_TYPE=postgres -e GF_DATABASE_NAME=grafana -e GF_DATABASE_PASSWORD=pmm_password
          -e GF_DATABASE_HOST=${postgresContainer}:5432 -e GF_DATABASE_USER=postgres
          ${ssl ? '-e GF_DATABASE_SSL_MODE=verify-ca -e GF_DATABASE_CA_CERT_PATH=/etc/ssl/postgresql/ca.crt -e GF_DATABASE_CLIENT_KEY_PATH=/etc/ssl/postgresql/client.key -e GF_DATABASE_CLIENT_CERT_PATH=/etc/ssl/postgresql/client.crt' : ''}
          -e PMM_ENABLE_INTERNAL_PG_QAN=1
          -v pmm-server-external-pg${ssl ? '-ssl' : ''}:/srv
          ${ssl ? `-v ${sslDir}:/etc/ssl/postgresql` : ''}
          ${dockerVersion}`,
      )
      .assertSuccess();

    await expect
      .poll(
        () =>
          this.cliHelper
            .execSilent(`docker inspect -f '{{.State.Health.Status}}' ${pmmContainer}`)
            .stdout.trim(),
        { intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES },
      )
      .toBe('healthy');
  };

  startPostgres = async (postgresContainer: string, ssl: boolean) => {
    this.cliHelper.execSilent('docker network create pmm-qa || true');
    this.cliHelper
      .execSilent(`mkdir -p ${workDir} && sudo install -d -o 26 -g 26 -m 0700 ${dataDir}`)
      .assertSuccess();

    if (ssl) {
      this.cliHelper
        .execute(
          `mkdir -p ${sslDir}
          && openssl genrsa -out ${sslDir}/ca.key 2048
          && openssl req -x509 -new -nodes -key ${sslDir}/ca.key -sha256 -days 3650 -subj '/CN=CA' -out ${sslDir}/ca.crt
          && openssl genrsa -out ${sslDir}/server.key 2048
          && openssl req -new -key ${sslDir}/server.key -config ${sslConfig} -out ${sslDir}/server.csr
          && openssl x509 -req -in ${sslDir}/server.csr -CA ${sslDir}/ca.crt -CAkey ${sslDir}/ca.key -CAcreateserial -out ${sslDir}/server.crt -days 365 -extensions v3_req -extfile ${sslConfig}
          && openssl genrsa -out ${sslDir}/client.key 2048
          && openssl req -new -key ${sslDir}/client.key -subj '/CN=client' -out ${sslDir}/client.csr
          && openssl x509 -req -in ${sslDir}/client.csr -CA ${sslDir}/ca.crt -CAkey ${sslDir}/ca.key -CAcreateserial -out ${sslDir}/client.crt -days 365 -sha256
          && sudo chown 26:26 ${sslDir}/ca.crt ${sslDir}/server.crt ${sslDir}/server.key
          && sudo chmod 0644 ${sslDir}/ca.crt
          && sudo chmod 0600 ${sslDir}/server.crt ${sslDir}/server.key
          && sudo chown 1000:1000 ${sslDir}/client.key ${sslDir}/client.crt
          && sudo chmod 0600 ${sslDir}/client.key ${sslDir}/client.crt`,
        )
        .assertSuccess();
    }

    this.cliHelper
      .execute(
        `docker run -d --name ${postgresContainer} --restart always --network=pmm-qa
          -e POSTGRES_PASSWORD=pmm_password -e POSTGRES_DB=grafana
          -v ${dataDir}:/var/lib/postgresql/data
          ${ssl ? `-v ${sslDir}:/var/lib/postgresql/ssl` : ''}
          ${postgresImage} postgres
          ${ssl ? '-c ssl=on -c ssl_ca_file=/var/lib/postgresql/ssl/ca.crt -c ssl_cert_file=/var/lib/postgresql/ssl/server.crt -c ssl_key_file=/var/lib/postgresql/ssl/server.key' : ''}
          -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track=all -c max_connections=1000`,
      )
      .assertSuccess();

    await expect
      .poll(
        () =>
          this.cliHelper.execSilent(
            `docker exec ${postgresContainer} psql -U postgres -d grafana -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"`,
          ).code,
        { intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.ONE_MINUTE },
      )
      .toBe(0);
  };
}
