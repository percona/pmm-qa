import {
  FrameworkService,
  frameworkServices,
  mongo,
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

interface ServerTls {
  // The form's client certificate fields, from the files `enable` generated.
  certificates: (cliHelper: CliHelper, container: string) => Partial<Record<TlsCertificateField, string>>;
  disable: (container: string) => string;
  // Generates a CA, a server certificate for the container's name and a client certificate,
  // and restarts the database to take TLS connections only.
  enable: (container: string) => string;
  plainProbe: (container: string, credentials: Credentials) => string;
  tlsProbe: (container: string, credentials: Credentials) => string;
  upMetric: string;
}

interface ServiceTls extends FrameworkService {
  certificateFields: TlsCertificateField[];
  // The API never returns stored secrets, only these flags in the exporter's options saying whether they are set.
  secretFlags: string[];
  secretOptions?: 'mongo_db_options' | 'mysql_options' | 'postgresql_options';
  serverTls?: ServerTls;
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
// Each certificate also goes into a cert+key PEM, the form MongoDB takes.
const caSignedCertificates = (dir: string, serverName: string) =>
  [
    `rm -rf ${dir} && mkdir -p ${dir}`,
    `openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=pmm-qa-ca -keyout ${dir}/ca.key -out ${dir}/ca.crt`,
    ...[
      { altName: `\\nsubjectAltName=DNS:${serverName}`, commonName: serverName, name: 'server' },
      { altName: '', commonName: 'pmm-test', name: 'client' },
    ].flatMap(({ altName, commonName, name }) => [
      `openssl req -newkey rsa:2048 -nodes -subj /CN=${commonName} -keyout ${dir}/${name}.key -out ${dir}/${name}.csr`,
      `printf "basicConstraints=CA:FALSE\\nextendedKeyUsage=serverAuth,clientAuth${altName}" > ${dir}/${name}.ext`,
      `openssl x509 -req -in ${dir}/${name}.csr -CA ${dir}/ca.crt -CAkey ${dir}/ca.key -CAcreateserial -days 1 -extfile ${dir}/${name}.ext -out ${dir}/${name}.crt`,
      `cat ${dir}/${name}.crt ${dir}/${name}.key > ${dir}/${name}.pem`,
    ]),
  ].join(' && ');
const mongodTlsDir = '/tmp/pmm_tls_mongod';
// mongod reads its options from this file; /etc/mongod/mongod.conf is shared with the other members.
const mongodOptions = '/etc/sysconfig/mongod';
const mongodOptionsBackup = '/tmp/pmm_tls_mongod.options';

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
    serverTls: {
      certificates: (cliHelper, container) => {
        const read = (file: string) =>
          cliHelper
            .execSilent(`docker exec ${container} cat ${mongodTlsDir}/${file}`)
            .assertSuccess()
            .stdout.trim();

        return { tlsCa: read('ca.crt'), tlsCertificateKey: read('client.pem') };
      },
      disable: (container) =>
        `docker exec ${container} sh -c 'cp ${mongodOptionsBackup} ${mongodOptions} && rm -rf ${mongodOptionsBackup} ${mongodTlsDir}' && docker exec ${container} systemctl restart mongod`,
      enable: (container) =>
        [
          `docker exec ${container} bash -c '${caSignedCertificates(mongodTlsDir, container)} && chown mongod:mongod ${mongodTlsDir}/server.pem ${mongodTlsDir}/ca.crt && chmod 600 ${mongodTlsDir}/server.pem'`,
          // Starts from the original options, should an earlier run have left TLS on.
          `docker exec ${container} sh -c '[ -f ${mongodOptionsBackup} ] || cp ${mongodOptions} ${mongodOptionsBackup}; cp ${mongodOptionsBackup} ${mongodOptions}'`,
          `docker exec ${container} sed -i '/^OPTIONS=/s#"$# --tlsMode requireTLS --tlsCertificateKeyFile ${mongodTlsDir}/server.pem --tlsCAFile ${mongodTlsDir}/ca.crt"#' ${mongodOptions}`,
          `docker exec ${container} grep -q requireTLS ${mongodOptions}`,
          `docker exec ${container} systemctl restart mongod`,
        ].join(' && '),
      plainProbe: (container, credentials) =>
        mongo(container, credentials, 'db.adminCommand({ ping: 1 }).ok'),
      tlsProbe: (container, { psmdb }) =>
        `docker exec ${container} mongo --quiet --tls --host localhost --port 27017 --tlsCAFile ${mongodTlsDir}/ca.crt --tlsCertificateKeyFile ${mongodTlsDir}/client.pem --tlsAllowInvalidCertificates -u ${psmdb.root.username} -p ${psmdb.root.password} --authenticationDatabase admin --eval 'db.adminCommand({ ping: 1 }).ok'`,
      upMetric: 'mongodb_up',
    },
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
