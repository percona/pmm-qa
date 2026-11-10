import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import { GetService, ServiceType } from '@interfaces/inventory';

export type ServiceAgent = GetService['agents'][number];

export type TlsCertificateField =
  'tlsCa' | 'tlsCert' | 'tlsCertificateKey' | 'tlsCertificateKeyFilePassword' | 'tlsKey';

export const tlsCertificateFields: TlsCertificateField[] = [
  'tlsCa',
  'tlsCert',
  'tlsKey',
  'tlsCertificateKey',
  'tlsCertificateKeyFilePassword',
];

export const tlsKeyPassword = 'Pmm9TlsKey_Test4';

export interface ServiceTls {
  // The update API's names for the certificates, cleared when the service is put back without TLS.
  apiCertificates: string[];
  certificateFields: TlsCertificateField[];
  exporterType: string;
  name: string;
  // The API never returns stored secrets, only these flags in the exporter's options saying whether they are set.
  secretFlags: string[];
  secretOptions?: 'mongo_db_options' | 'mysql_options' | 'postgresql_options';
  serviceRegex: string;
}

export const storedTlsSecrets = ({ secretFlags, secretOptions }: ServiceTls, exporter: ServiceAgent) =>
  Object.fromEntries(
    secretFlags.map((flag) => [
      flag,
      !!(secretOptions && (exporter[secretOptions] as Record<string, unknown> | undefined)?.[flag]),
    ]),
  );

export const expectedTlsSecrets = ({ secretFlags }: ServiceTls, set: boolean) =>
  Object.fromEntries(secretFlags.map((flag) => [flag, set]));

const pemCertificates: Pick<ServiceTls, 'apiCertificates' | 'certificateFields'> = {
  apiCertificates: ['tls_ca', 'tls_cert', 'tls_key'],
  certificateFields: ['tlsCa', 'tlsCert', 'tlsKey'],
};

export const serviceTlsSettings: ServiceTls[] = [
  {
    ...pemCertificates,
    exporterType: 'postgres_exporter',
    name: 'pdpgsql',
    secretFlags: ['is_ssl_key_set'],
    secretOptions: 'postgresql_options',
    serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$',
  },
  {
    ...pemCertificates,
    exporterType: 'mysqld_exporter',
    name: 'ps',
    secretFlags: ['is_tls_key_set'],
    secretOptions: 'mysql_options',
    serviceRegex: '^ps_pmm',
  },
  {
    apiCertificates: ['tls_ca', 'tls_certificate_key', 'tls_certificate_key_file_password'],
    certificateFields: ['tlsCa', 'tlsCertificateKey', 'tlsCertificateKeyFilePassword'],
    exporterType: 'mongodb_exporter',
    name: 'psmdb',
    secretFlags: ['is_tls_certificate_key_set', 'is_tls_certificate_key_file_password_set'],
    secretOptions: 'mongo_db_options',
    serviceRegex: '^rs101_',
  },
  {
    ...pemCertificates,
    exporterType: 'valkey_exporter',
    name: 'valkey',
    secretFlags: [],
    serviceRegex: '^valkey-primary',
  },
  {
    apiCertificates: [],
    certificateFields: [],
    exporterType: 'proxysql_exporter',
    name: 'proxysql',
    secretFlags: [],
    serviceRegex: '^my-new-proxysql_',
  },
];

export type TlsServerName = 'ps' | 'psmdb' | 'ssl_mysql' | 'ssl_pdpgsql' | 'valkey';

export interface TlsInstance {
  // Registers the instance over TLS without verification, so the edit starts from a working exporter.
  register: (container: string) => string;
  serviceName: string;
  serviceType: ServiceType;
  start: (container: string) => string;
  stop: (container: string) => string;
}

export interface TlsServer {
  exporterType: string;
  // A TLS-only server the test starts itself, for a type whose framework setup in this job has no TLS.
  instance?: TlsInstance;
  name: TlsServerName;
  // The update API settings that put a framework service back as it was found.
  original?: (cliHelper: CliHelper, container: string, exporter: ServiceAgent) => Record<string, unknown>;
  // A command that fails unless the database serves TLS, for a service registered without it.
  serverTlsCheck?: (container: string, credentials: Credentials) => string;
  // The service under test, or the framework service whose container runs the test's own instance.
  serviceRegex: string;
}

const certificatesFrom = ({ ca, cert, key }: { ca: string; cert: string; key: string }) => ({
  tls_ca: ca,
  tls_cert: cert,
  tls_key: key,
});
// The address in the certificate lets hostname verification pass, so only the CA decides whether it is trusted.
const serverCertificate = (dir: string) =>
  `openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=pmm-tls-server -addext subjectAltName=IP:127.0.0.1 -keyout ${dir}/server.key -out ${dir}/server.crt 2>/dev/null`;
const mongodbTlsDir = '/tmp/pmm_tls_mongodb';
const mongodbTlsPort = 27_098;
const valkeyTlsDir = '/tmp/pmm_tls_valkey';
const valkeyTlsPort = 6_390;

export const tlsServers: TlsServer[] = [
  {
    exporterType: 'mysqld_exporter',
    name: 'ps',
    original: () => ({ tls: false, tls_ca: '', tls_cert: '', tls_key: '', tls_skip_verify: false }),
    // Percona Server generates its own certificates and serves TLS unless told not to.
    serverTlsCheck: (container, { perconaServer }) =>
      `docker exec -e MYSQL_PWD='${perconaServer.ps_84.password}' ${container} mysql -u${perconaServer.ps_84.username} -h127.0.0.1 --ssl-mode=REQUIRED -e "SELECT 1"`,
    serviceRegex: '^ps_pmm',
  },
  {
    exporterType: 'mysqld_exporter',
    name: 'ssl_mysql',
    original: (cliHelper, container, { tls_skip_verify }) => ({
      tls: true,
      tls_skip_verify: !!tls_skip_verify,
      ...certificatesFrom(cliHelper.readMysqlTlsCertificates(container)),
    }),
    serviceRegex: '^mysql_ssl_8.4_ssl_service_',
  },
  {
    exporterType: 'postgres_exporter',
    name: 'ssl_pdpgsql',
    original: (cliHelper, container, { tls_skip_verify }) => ({
      tls: true,
      tls_skip_verify: !!tls_skip_verify,
      ...certificatesFrom(cliHelper.readTlsCertificates(container)),
    }),
    serviceRegex: '^pdpgsql_pgsm_ssl_16_ssl_service',
  },
  {
    exporterType: 'mongodb_exporter',
    instance: {
      register: (container) =>
        `docker exec ${container} pmm-admin add mongodb --host=127.0.0.1 --port=${mongodbTlsPort} --query-source=none --tls --tls-skip-verify pmm_tls_mongodb_check`,
      serviceName: 'pmm_tls_mongodb_check',
      serviceType: ServiceType.mongodb,
      start: (container) =>
        `docker exec ${container} sh -c 'rm -rf ${mongodbTlsDir} && mkdir -p ${mongodbTlsDir} && ${serverCertificate(mongodbTlsDir)} && cat ${mongodbTlsDir}/server.key ${mongodbTlsDir}/server.crt > ${mongodbTlsDir}/server.pem && mongod --port ${mongodbTlsPort} --bind_ip 127.0.0.1 --dbpath ${mongodbTlsDir} --logpath ${mongodbTlsDir}/mongod.log --fork --tlsMode requireTLS --tlsCertificateKeyFile ${mongodbTlsDir}/server.pem --tlsCAFile ${mongodbTlsDir}/server.crt --tlsAllowConnectionsWithoutCertificates >/dev/null'`,
      stop: (container) =>
        `docker exec ${container} sh -c 'mongod --dbpath ${mongodbTlsDir} --shutdown >/dev/null 2>&1; rm -rf ${mongodbTlsDir}'`,
    },
    name: 'psmdb',
    serviceRegex: '^rs101_',
  },
  {
    exporterType: 'valkey_exporter',
    instance: {
      register: (container) =>
        `docker exec ${container} pmm-admin add valkey --host=127.0.0.1 --port=${valkeyTlsPort} --tls --tls-skip-verify pmm_tls_valkey_check`,
      serviceName: 'pmm_tls_valkey_check',
      serviceType: ServiceType.valkey,
      // valkey-server forks before it listens, so the command waits for the TLS port to answer.
      start: (container) =>
        `docker exec ${container} sh -c 'rm -rf ${valkeyTlsDir} && mkdir -p ${valkeyTlsDir} && ${serverCertificate(valkeyTlsDir)} && valkey-server --port 0 --tls-port ${valkeyTlsPort} --bind 127.0.0.1 --tls-cert-file ${valkeyTlsDir}/server.crt --tls-key-file ${valkeyTlsDir}/server.key --tls-ca-cert-file ${valkeyTlsDir}/server.crt --tls-auth-clients no --dir ${valkeyTlsDir} --save "" --pidfile ${valkeyTlsDir}/valkey.pid --logfile ${valkeyTlsDir}/valkey.log --daemonize yes && timeout 30 sh -c "until valkey-cli --tls --insecure -p ${valkeyTlsPort} ping >/dev/null 2>&1; do sleep 1; done"'`,
      stop: (container) =>
        `docker exec ${container} sh -c 'pid=$(cat ${valkeyTlsDir}/valkey.pid 2>/dev/null) && kill $pid && while kill -0 $pid 2>/dev/null; do sleep 1; done; rm -rf ${valkeyTlsDir}'`,
    },
    name: 'valkey',
    serviceRegex: '^valkey-primary',
  },
];
