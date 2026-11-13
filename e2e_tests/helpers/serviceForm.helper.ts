import { databaseServices, frameworkServices } from '@helpers/frameworkServices.helper';
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

export const formServices = [...databaseServices, frameworkServices.haproxy];

// As the read-only Service block shows where the service is reached, if anywhere.
export const serviceEndpoint = ({ address, port, socket }: GetService) => {
  if (socket) return { label: 'Socket', value: socket };
  if (address) return { label: 'Address', value: port ? `${address}:${port}` : address };

  return undefined;
};

type ValidatedField =
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
    serviceRegex: frameworkServices.ps.serviceRegex,
    value: 'bad-label:value',
  },
  {
    field: 'extraDsnParams',
    label: 'DSN parameter with an invalid name',
    message: 'Parameters have to be in name:value format, one per line',
    serviceRegex: frameworkServices.ps.serviceRegex,
    value: 'bad-param:1',
  },
  {
    field: 'maxQueryLength',
    label: 'max query length below -1',
    message: 'Enter a whole number of -1 or more',
    serviceRegex: frameworkServices.ps.serviceRegex,
    value: '-5',
  },
  {
    field: 'tablestatsGroupTableLimit',
    label: 'fractional tablestats limit',
    message: 'Enter a whole number of -1 or more',
    serviceRegex: frameworkServices.ps.serviceRegex,
    value: '1.5',
  },
  {
    field: 'maxExporterConnections',
    label: 'negative max exporter connections',
    message: 'Enter a whole number of 0 or more',
    serviceRegex: frameworkServices.pdpgsql.serviceRegex,
    value: '-1',
  },
  {
    field: 'listenPort',
    label: 'listen port 0',
    message: 'Enter a port between 1 and 65535',
    serviceRegex: frameworkServices.haproxy.serviceRegex,
    value: '0',
  },
  {
    field: 'listenPort',
    label: 'listen port above 65535',
    message: 'Enter a port between 1 and 65535',
    serviceRegex: frameworkServices.haproxy.serviceRegex,
    value: '70000',
  },
  {
    field: 'username',
    label: 'empty username',
    message: 'Required field',
    serviceRegex: frameworkServices.ps.serviceRegex,
    value: '',
  },
];

// The UI shows an API error's message as a notification, cut at 120 characters.
export const toNotificationText = (message: string) => {
  const text = message.trim();

  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
};

export const formUserPassword = 'Pmm9EditUser_Test4';
