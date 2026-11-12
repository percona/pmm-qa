import {
  FrameworkService,
  frameworkServices,
  mongo,
  ownMongod,
  OwnService,
  mysql,
  psql,
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
  disable: (container: string, credentials: Credentials) => string;
  // Generates a CA, a server certificate for the container's name and a client certificate, and sets the
  // database to take TLS connections with them: TLS connections only, where `tlsOnly` says so.
  enable: (container: string, credentials: Credentials) => string;
  plainProbe: (container: string, credentials: Credentials) => string;
  tlsOnly: boolean;
  tlsProbe: (container: string, credentials: Credentials) => string;
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
const pemFiles = { tlsCa: 'ca.crt', tlsCert: 'client.crt', tlsKey: 'client.key' };

// The server certificate names the container and 127.0.0.1, the hosts the services are registered with, so it
// passes verification. Each certificate also goes into a cert+key PEM, the form MongoDB takes.
const generateCertificates = (container: string, dir: string, owner: string) => {
  const commands = [
    `rm -rf ${dir} && mkdir -p ${dir}`,
    `openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=pmm-qa-ca -keyout ${dir}/ca.key -out ${dir}/ca.crt`,
    ...[
      { altName: `\\nsubjectAltName=DNS:${container},IP:127.0.0.1`, commonName: container, name: 'server' },
      { altName: '', commonName: 'pmm-test', name: 'client' },
    ].flatMap(({ altName, commonName, name }) => [
      `openssl req -newkey rsa:2048 -nodes -subj /CN=${commonName} -keyout ${dir}/${name}.key -out ${dir}/${name}.csr`,
      `printf "basicConstraints=CA:FALSE\\nextendedKeyUsage=serverAuth,clientAuth${altName}" > ${dir}/${name}.ext`,
      `openssl x509 -req -in ${dir}/${name}.csr -CA ${dir}/ca.crt -CAkey ${dir}/ca.key -CAcreateserial -days 1 -extfile ${dir}/${name}.ext -out ${dir}/${name}.crt`,
      `cat ${dir}/${name}.crt ${dir}/${name}.key > ${dir}/${name}.pem`,
    ]),
    `chown -R ${owner}:${owner} ${dir} && chmod 600 ${dir}/*.key ${dir}/*.pem`,
  ];

  return `docker exec ${container} bash -c '${commands.join(' && ')}'`;
};

const readCertificates = (
  cliHelper: CliHelper,
  container: string,
  dir: string,
  files: Partial<Record<TlsCertificateField, string>>,
) =>
  Object.fromEntries(
    Object.entries(files).map(([field, file]) => [
      field,
      cliHelper.execSilent(`docker exec ${container} cat ${dir}/${file}`).assertSuccess().stdout.trim(),
    ]),
  );
const mongodTlsDir = '/tmp/pmm_tls_mongod';
// mongod reads its options from this file; /etc/mongod/mongod.conf is shared with the other members.
const mongodOptions = '/etc/sysconfig/mongod';
const mongodOptionsBackup = '/tmp/pmm_tls_mongod.options';
const mysqlTlsDir = '/tmp/pmm_tls_mysql';
const mysqlTlsBackup = '/tmp/pmm_tls_mysql.orig';
const postgresTlsDir = '/tmp/pmm_tls_postgresql';
const postgresHbaBackup = '/tmp/pmm_tls_postgresql.hba';
const hbaFile = (container: string) =>
  `$(docker exec --user postgres ${container} psql -tAc 'SHOW hba_file')`;
const postgresConnection = ({ pdpgsql }: Credentials, ssl: string) =>
  `"host=127.0.0.1 dbname=postgres user=${pdpgsql.username} password=${pdpgsql.password} ${ssl}"`;
const valkeyServerTlsDir = '/tmp/pmm_tls_valkey_server';
const valkeyPort = 6_379;
const valkeyTlsCli = `valkey-cli --tls --cacert ${valkeyServerTlsDir}/ca.crt --cert ${valkeyServerTlsDir}/client.crt --key ${valkeyServerTlsDir}/client.key`;
// Fails unless valkey answers OK to every setting.
const valkeyConfig = (cli: string, { valkey }: Credentials, settings: string[]) =>
  `printf "${settings.map((setting) => `CONFIG SET ${setting}`).join('\\n')}\\n" | ${cli} -a ${valkey.password} --no-auth-warning | { ! grep -v "^OK$"; }`;
const proxysqlSslBackup = '/tmp/pmm_tls_proxysql.orig';
const proxysqlAdmin = ({ proxysql }: Credentials, sql: string, flags = '') =>
  `mysql -u${proxysql.username} -h127.0.0.1 -P6032 ${flags} -e "${sql}"`;

export const serviceTlsSettings: ServiceTls[] = [
  {
    ...frameworkServices.pdpgsql,
    certificateFields: pemCertificates,
    secretFlags: ['is_ssl_key_set'],
    secretOptions: 'postgresql_options',
    serverTls: {
      certificates: (cliHelper, container) =>
        readCertificates(cliHelper, container, postgresTlsDir, pemFiles),
      disable: (container) =>
        [
          psql(
            container,
            'ALTER SYSTEM RESET ssl',
            'ALTER SYSTEM RESET ssl_cert_file',
            'ALTER SYSTEM RESET ssl_key_file',
            'ALTER SYSTEM RESET ssl_ca_file',
          ),
          `hba=${hbaFile(container)}`,
          `docker exec ${container} sh -c "cp ${postgresHbaBackup} $hba && rm -rf ${postgresHbaBackup} ${postgresTlsDir}"`,
          psql(container, 'SELECT pg_reload_conf()'),
        ].join(' && '),
      enable: (container) =>
        [
          generateCertificates(container, postgresTlsDir, 'postgres'),
          // TCP connections need TLS from then on; the socket the tests run psql through stays open.
          `hba=${hbaFile(container)}`,
          `docker exec ${container} sh -c "[ -f ${postgresHbaBackup} ] || cp $hba ${postgresHbaBackup}; cp ${postgresHbaBackup} $hba && sed -E -i 's/^host([[:space:]])/hostssl\\1/' $hba"`,
          psql(
            container,
            'ALTER SYSTEM SET ssl = on',
            `ALTER SYSTEM SET ssl_cert_file = '${postgresTlsDir}/server.crt'`,
            `ALTER SYSTEM SET ssl_key_file = '${postgresTlsDir}/server.key'`,
            `ALTER SYSTEM SET ssl_ca_file = '${postgresTlsDir}/ca.crt'`,
            'SELECT pg_reload_conf()',
          ),
        ].join(' && '),
      plainProbe: (container, credentials) =>
        `docker exec ${container} psql ${postgresConnection(credentials, 'sslmode=disable')} -tAc "SELECT 1"`,
      tlsOnly: true,
      // As postgres, which owns the client key: libpq refuses a key it cannot be sure is private.
      tlsProbe: (container, credentials) =>
        `docker exec --user postgres ${container} psql ${postgresConnection(credentials, `sslmode=verify-full sslrootcert=${postgresTlsDir}/ca.crt sslcert=${postgresTlsDir}/client.crt sslkey=${postgresTlsDir}/client.key`)} -tAc "SELECT 1"`,
    },
  },
  {
    ...frameworkServices.ps,
    certificateFields: pemCertificates,
    secretFlags: ['is_tls_key_set'],
    secretOptions: 'mysql_options',
    serverTls: {
      certificates: (cliHelper, container) => readCertificates(cliHelper, container, mysqlTlsDir, pemFiles),
      // Puts back Percona Server's own certificates, which the TLS verification tests rely on.
      disable: (container, { perconaServer }) =>
        `docker exec -e MYSQL_PWD='${perconaServer.ps_84.password}' ${container} sh -c 'read ca cert key < ${mysqlTlsBackup} && mysql -u${perconaServer.ps_84.username} -e "SET GLOBAL require_secure_transport = OFF, ssl_ca = \\"$ca\\", ssl_cert = \\"$cert\\", ssl_key = \\"$key\\"; ALTER INSTANCE RELOAD TLS" && rm -rf ${mysqlTlsBackup} ${mysqlTlsDir}'`,
      // Over the socket, which require_secure_transport leaves open.
      enable: (container, credentials) =>
        [
          generateCertificates(container, mysqlTlsDir, 'mysql'),
          `docker exec -e MYSQL_PWD='${credentials.perconaServer.ps_84.password}' ${container} sh -c '[ -f ${mysqlTlsBackup} ] || mysql -u${credentials.perconaServer.ps_84.username} -NBe "SELECT @@ssl_ca, @@ssl_cert, @@ssl_key" > ${mysqlTlsBackup}'`,
          mysql(
            container,
            credentials,
            `SET GLOBAL ssl_ca = '${mysqlTlsDir}/ca.crt', ssl_cert = '${mysqlTlsDir}/server.crt', ssl_key = '${mysqlTlsDir}/server.key'; ALTER INSTANCE RELOAD TLS; SET GLOBAL require_secure_transport = ON`,
          ),
        ].join(' && '),
      plainProbe: (container, credentials) =>
        mysql(container, credentials, 'SELECT 1', '-h127.0.0.1 --ssl-mode=DISABLED'),
      tlsOnly: true,
      tlsProbe: (container, credentials) =>
        mysql(
          container,
          credentials,
          'SELECT 1',
          `-h127.0.0.1 --ssl-mode=VERIFY_CA --ssl-ca=${mysqlTlsDir}/ca.crt --ssl-cert=${mysqlTlsDir}/client.crt --ssl-key=${mysqlTlsDir}/client.key`,
        ),
    },
  },
  {
    ...frameworkServices.psmdb,
    certificateFields: ['tlsCa', 'tlsCertificateKey', 'tlsCertificateKeyFilePassword'],
    secretFlags: ['is_tls_certificate_key_set', 'is_tls_certificate_key_file_password_set'],
    secretOptions: 'mongo_db_options',
    serverTls: {
      certificates: (cliHelper, container) =>
        readCertificates(cliHelper, container, mongodTlsDir, {
          tlsCa: 'ca.crt',
          tlsCertificateKey: 'client.pem',
        }),
      disable: (container) =>
        `docker exec ${container} sh -c 'cp ${mongodOptionsBackup} ${mongodOptions} && rm -rf ${mongodOptionsBackup} ${mongodTlsDir}' && docker exec ${container} systemctl restart mongod`,
      enable: (container) =>
        [
          generateCertificates(container, mongodTlsDir, 'mongod'),
          // Starts from the original options, should an earlier run have left TLS on.
          `docker exec ${container} sh -c '[ -f ${mongodOptionsBackup} ] || cp ${mongodOptions} ${mongodOptionsBackup}; cp ${mongodOptionsBackup} ${mongodOptions}'`,
          `docker exec ${container} sed -i '/^OPTIONS=/s#"$# --tlsMode requireTLS --tlsCertificateKeyFile ${mongodTlsDir}/server.pem --tlsCAFile ${mongodTlsDir}/ca.crt"#' ${mongodOptions}`,
          `docker exec ${container} grep -q requireTLS ${mongodOptions}`,
          `docker exec ${container} systemctl restart mongod`,
        ].join(' && '),
      plainProbe: (container, credentials) =>
        mongo(container, credentials, 'db.adminCommand({ ping: 1 }).ok'),
      tlsOnly: true,
      tlsProbe: (container, { psmdb }) =>
        `docker exec ${container} mongo --quiet --tls --host localhost --port 27017 --tlsCAFile ${mongodTlsDir}/ca.crt --tlsCertificateKeyFile ${mongodTlsDir}/client.pem --tlsAllowInvalidCertificates -u ${psmdb.root.username} -p ${psmdb.root.password} --authenticationDatabase admin --eval 'db.adminCommand({ ping: 1 }).ok'`,
    },
  },
  {
    ...frameworkServices.valkey,
    certificateFields: pemCertificates,
    secretFlags: [],
    serverTls: {
      certificates: (cliHelper, container) =>
        readCertificates(cliHelper, container, valkeyServerTlsDir, pemFiles),
      // Over TLS when the port serves it, else over the plain one an unfinished `enable` left.
      disable: (container, credentials) =>
        `docker exec ${container} sh -c '${valkeyConfig(valkeyTlsCli, credentials, ['tls-port 0', `port ${valkeyPort}`])} || ${valkeyConfig('valkey-cli', credentials, ['tls-port 0', `port ${valkeyPort}`])}; rm -rf ${valkeyServerTlsDir}'`,
      // At runtime, as a restart would take the node out of its cluster: the plain port gives way to a TLS
      // one with the number the service is registered with.
      enable: (container, credentials) =>
        [
          generateCertificates(container, valkeyServerTlsDir, 'root'),
          // The certificate settings in one CONFIG SET, which applies them together.
          `docker exec ${container} sh -c '${valkeyConfig('valkey-cli', credentials, [
            `tls-cert-file ${valkeyServerTlsDir}/server.crt tls-key-file ${valkeyServerTlsDir}/server.key tls-ca-cert-file ${valkeyServerTlsDir}/ca.crt`,
            'port 0',
            `tls-port ${valkeyPort}`,
          ])}'`,
        ].join(' && '),
      plainProbe: (container, { valkey }) =>
        `docker exec ${container} sh -c 'valkey-cli -a ${valkey.password} --no-auth-warning -p ${valkeyPort} ping | grep -q PONG'`,
      tlsOnly: true,
      tlsProbe: (container, { valkey }) =>
        `docker exec ${container} sh -c '${valkeyTlsCli} -h ${container} -p ${valkeyPort} -a ${valkey.password} --no-auth-warning ping | grep -q PONG'`,
    },
  },
  {
    ...frameworkServices.proxysql,
    certificateFields: [],
    secretFlags: [],
    // The admin interface the exporter reads offers TLS with ProxySQL's own certificate when mysql-have_ssl
    // is on, but cannot refuse connections without it, and the form takes no CA to verify that certificate.
    serverTls: {
      certificates: () => ({}),
      disable: (container, credentials) =>
        `docker exec -e MYSQL_PWD='${credentials.proxysql.password}' ${container} sh -c 'value=$(cat ${proxysqlSslBackup}) && ${proxysqlAdmin(credentials, `UPDATE global_variables SET variable_value = '\\''$value'\\'' WHERE variable_name = '\\''mysql-have_ssl'\\''; LOAD MYSQL VARIABLES TO RUNTIME`)} && rm -f ${proxysqlSslBackup}'`,
      enable: (container, credentials) =>
        [
          `docker exec -e MYSQL_PWD='${credentials.proxysql.password}' ${container} sh -c '[ -f ${proxysqlSslBackup} ] || ${proxysqlAdmin(credentials, `SELECT variable_value FROM global_variables WHERE variable_name = '\\''mysql-have_ssl'\\''`, '-NB')} > ${proxysqlSslBackup}'`,
          `docker exec -e MYSQL_PWD='${credentials.proxysql.password}' ${container} ${proxysqlAdmin(credentials, "UPDATE global_variables SET variable_value = 'true' WHERE variable_name = 'mysql-have_ssl'; LOAD MYSQL VARIABLES TO RUNTIME")}`,
        ].join(' && '),
      plainProbe: (container, credentials) =>
        `docker exec -e MYSQL_PWD='${credentials.proxysql.password}' ${container} ${proxysqlAdmin(credentials, 'SELECT 1', '--ssl-mode=DISABLED')}`,
      tlsOnly: false,
      tlsProbe: (container, credentials) =>
        `docker exec -e MYSQL_PWD='${credentials.proxysql.password}' ${container} ${proxysqlAdmin(credentials, 'SELECT 1', '--ssl-mode=REQUIRED')}`,
    },
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
