import {
  FrameworkService,
  frameworkServices,
  ownMongod,
  OwnService,
  mysql,
} from '@helpers/frameworkServices.helper';
import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import { ServiceAgent, ServiceType } from '@interfaces/inventory';

export const tlsCertificateFields = [
  'tlsCa',
  'tlsCert',
  'tlsKey',
  'tlsCertificateKey',
  'tlsCertificateKeyFilePassword',
] as const;

export type TlsCertificateField = (typeof tlsCertificateFields)[number];

export const tlsKeyPassword = 'Pmm9TlsKey_Test4';

interface ServiceTls extends FrameworkService {
  certificateFields: TlsCertificateField[];
  // The API never returns stored secrets, only these flags in the exporter's options saying whether they are set.
  secretFlags: string[];
  secretOptions?: 'mongo_db_options' | 'mysql_options' | 'postgresql_options';
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

// The update API names each certificate field in snake case, and an empty one clears what is stored.
export const tlsOffChanges = (certificateFields: TlsCertificateField[]) => ({
  tls: false,
  tls_skip_verify: false,
  ...Object.fromEntries(
    certificateFields.map((field) => [field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), '']),
  ),
});

const pemCertificates: TlsCertificateField[] = ['tlsCa', 'tlsCert', 'tlsKey'];

export const serviceTlsSettings: ServiceTls[] = [
  {
    ...frameworkServices.pdpgsql,
    certificateFields: pemCertificates,
    secretFlags: ['is_ssl_key_set'],
    secretOptions: 'postgresql_options',
  },
  {
    ...frameworkServices.ps,
    certificateFields: pemCertificates,
    secretFlags: ['is_tls_key_set'],
    secretOptions: 'mysql_options',
  },
  {
    ...frameworkServices.psmdb,
    certificateFields: ['tlsCa', 'tlsCertificateKey', 'tlsCertificateKeyFilePassword'],
    secretFlags: ['is_tls_certificate_key_set', 'is_tls_certificate_key_file_password_set'],
    secretOptions: 'mongo_db_options',
  },
  {
    ...frameworkServices.valkey,
    certificateFields: pemCertificates,
    secretFlags: [],
  },
  {
    ...frameworkServices.proxysql,
    certificateFields: [],
    secretFlags: [],
  },
];

export type TlsServerName = 'ps' | 'psmdb' | 'ssl_mysql' | 'ssl_pdpgsql' | 'valkey';

interface TlsServer extends FrameworkService {
  // A TLS-only server the test starts itself, for a type whose framework setup in this job has no TLS,
  // registered over TLS without verification so the edit starts from a working exporter.
  instance?: Required<OwnService>;
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
const valkeyTlsDir = '/tmp/pmm_tls_valkey';
const valkeyTlsPort = 6_390;

export const tlsServers: TlsServer[] = [
  {
    ...frameworkServices.ps,
    original: () => tlsOffChanges(pemCertificates),
    // Percona Server generates its own certificates and serves TLS unless told not to.
    serverTlsCheck: (container, credentials) =>
      mysql(container, credentials, 'SELECT 1', '-h127.0.0.1 --ssl-mode=REQUIRED'),
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
    ...frameworkServices.psmdb,
    instance: ownMongod({
      addFlags: '--tls --tls-skip-verify',
      dir: mongodbTlsDir,
      mongodFlags: `--tlsMode requireTLS --tlsCertificateKeyFile ${mongodbTlsDir}/server.pem --tlsCAFile ${mongodbTlsDir}/server.crt --tlsAllowConnectionsWithoutCertificates`,
      port: 27_098,
      prepare: `${serverCertificate(mongodbTlsDir)} && cat ${mongodbTlsDir}/server.key ${mongodbTlsDir}/server.crt > ${mongodbTlsDir}/server.pem`,
      serviceName: 'pmm_tls_mongodb_check',
    }),
  },
  {
    ...frameworkServices.valkey,
    instance: {
      register: (container) =>
        `docker exec ${container} pmm-admin add valkey --host=127.0.0.1 --port=${valkeyTlsPort} --tls --tls-skip-verify pmm_tls_valkey_check`,
      serviceName: 'pmm_tls_valkey_check',
      serviceType: ServiceType.valkey,
      // valkey-server forks before it listens, so the command waits for the TLS port to answer.
      start: (container) =>
        `docker exec ${container} sh -c 'rm -rf ${valkeyTlsDir} && mkdir -p ${valkeyTlsDir} && ${serverCertificate(valkeyTlsDir)} && valkey-server --port 0 --tls-port ${valkeyTlsPort} --bind 127.0.0.1 --tls-cert-file ${valkeyTlsDir}/server.crt --tls-key-file ${valkeyTlsDir}/server.key --tls-ca-cert-file ${valkeyTlsDir}/server.crt --tls-auth-clients no --dir ${valkeyTlsDir} --save "" --pidfile ${valkeyTlsDir}/valkey.pid --logfile ${valkeyTlsDir}/valkey.log --daemonize yes && timeout 30 sh -c "until valkey-cli --tls --insecure -p ${valkeyTlsPort} ping >/dev/null 2>&1; do sleep 0.2; done"'`,
      stop: (container) =>
        `docker exec ${container} sh -c 'pid=$(cat ${valkeyTlsDir}/valkey.pid 2>/dev/null) && kill $pid && while kill -0 $pid 2>/dev/null; do sleep 0.2; done; rm -rf ${valkeyTlsDir}'`,
    },
  },
];
