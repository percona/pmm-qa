import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import { GetService } from '@interfaces/inventory';

type ServiceAgent = GetService['agents'][number];

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

export interface TlsServer {
  exporterType: string;
  name: string;
  // The update API settings that put the service back as it was found.
  original: (cliHelper: CliHelper, container: string, exporter: ServiceAgent) => Record<string, unknown>;
  serviceRegex: string;
  // A command that fails unless the database serves TLS, for a service registered without it.
  serverTlsCheck?: (container: string, credentials: Credentials) => string;
  tag: string;
}

const certificatesFrom = ({ ca, cert, key }: { ca: string; cert: string; key: string }) => ({
  tls_ca: ca,
  tls_cert: cert,
  tls_key: key,
});

export const tlsServers: TlsServer[] = [
  {
    exporterType: 'mysqld_exporter',
    name: 'ps',
    original: () => ({ tls: false, tls_ca: '', tls_cert: '', tls_key: '', tls_skip_verify: false }),
    // Percona Server generates its own certificates and serves TLS unless told not to.
    serverTlsCheck: (container, { perconaServer }) =>
      `docker exec -e MYSQL_PWD='${perconaServer.ps_84.password}' ${container} mysql -u${perconaServer.ps_84.username} -h127.0.0.1 --ssl-mode=REQUIRED -e "SELECT 1"`,
    serviceRegex: '^ps_pmm',
    tag: '@inventory',
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
    tag: '@ssl-mysql',
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
    tag: '@ssl-postgres',
  },
];
