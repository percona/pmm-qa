import { GetService } from '@interfaces/inventory';

export const serviceTypeLabels: Record<string, string> = {
  external: 'External',
  haproxy: 'HAProxy',
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  proxysql: 'ProxySQL',
  valkey: 'Valkey',
};

export const formServices = [
  { name: 'pdpgsql', serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$' },
  { name: 'ps', serviceRegex: '^ps_pmm' },
  { name: 'psmdb', serviceRegex: '^rs101_' },
  { name: 'valkey', serviceRegex: '^valkey-primary' },
  { name: 'proxysql', serviceRegex: '^my-new-proxysql_' },
  { name: 'haproxy', serviceRegex: '^haproxy_pmm_service_' },
];

// As the read-only Service block shows where the service is reached, if anywhere.
export const serviceEndpoint = ({ address, port, socket }: GetService) => {
  if (socket) return { label: 'Socket', value: socket };
  if (address) return { label: 'Address', value: port ? `${address}:${port}` : address };

  return undefined;
};

export type ValidatedField =
  | 'customLabels'
  | 'extraDsnParams'
  | 'listenPort'
  | 'maxExporterConnections'
  | 'maxQueryLength'
  | 'tablestatsGroupTableLimit'
  | 'username';

export const validationCases: {
  field: ValidatedField;
  label: string;
  message: string;
  serviceRegex: string;
  value: string;
}[] = [
  {
    field: 'customLabels',
    label: 'custom label with an invalid name',
    message: 'Values have to be in key:value format, and separated with new line or space',
    serviceRegex: '^ps_pmm',
    value: 'bad-label:value',
  },
  {
    field: 'extraDsnParams',
    label: 'DSN parameter with an invalid name',
    message: 'Parameters have to be in name:value format, one per line',
    serviceRegex: '^ps_pmm',
    value: 'bad-param:1',
  },
  {
    field: 'maxQueryLength',
    label: 'max query length below -1',
    message: 'Enter a whole number of -1 or more',
    serviceRegex: '^ps_pmm',
    value: '-5',
  },
  {
    field: 'tablestatsGroupTableLimit',
    label: 'fractional tablestats limit',
    message: 'Enter a whole number of -1 or more',
    serviceRegex: '^ps_pmm',
    value: '1.5',
  },
  {
    field: 'maxExporterConnections',
    label: 'negative max exporter connections',
    message: 'Enter a whole number of 0 or more',
    serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$',
    value: '-1',
  },
  {
    field: 'listenPort',
    label: 'listen port 0',
    message: 'Enter a port between 1 and 65535',
    serviceRegex: '^haproxy_pmm_service_',
    value: '0',
  },
  {
    field: 'listenPort',
    label: 'listen port above 65535',
    message: 'Enter a port between 1 and 65535',
    serviceRegex: '^haproxy_pmm_service_',
    value: '70000',
  },
  {
    field: 'username',
    label: 'empty username',
    message: 'Required field',
    serviceRegex: '^ps_pmm',
    value: '',
  },
];

// The UI shows an API error's message as a notification, cut at 120 characters.
export const toNotificationText = (message: string) => {
  const text = message.trim();

  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
};

export const formUserPassword = 'Pmm9EditUser_Test4';
