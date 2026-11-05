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
];
