import { S3LocationConfig } from '@api/backups.api';
import CliHelper from '@helpers/cli.helper';
import PostgresqlHelper from '@helpers/postgresql.helper';

interface ValkeyTlsOptions {
  ssl_ca: string;
  ssl_cert: string;
  ssl_key: string;
}

// pmm-managed stores a secret as this prefix and the base64 of a Tink ciphertext, whose bytes 1-4 are the ID of the
// key that encrypted it.
export const encryptedValue = /^pmm1\$[A-Za-z0-9+/]+={0,2}$/;

export default class EncryptionHelper {
  constructor(
    private readonly cliHelper: CliHelper,
    private readonly postgresqlHelper: PostgresqlHelper,
  ) {}

  keyId = (stored: string) => Buffer.from(stored.slice('pmm1$'.length), 'base64').readUInt32BE(1);

  logFilesContaining = (container: string, values: string[]) => {
    const patterns = values.map((value) => `-e ${CliHelper.shellQuote(value)}`).join(' ');
    // grep exits 1 when nothing matches, 2 on an error.
    const { code, stderr, stdout } = this.cliHelper.execSilent(
      `docker exec ${container} grep -rlF ${patterns} /srv/logs`,
    );

    if (code > 1) throw new Error(`Searching the logs of ${container} failed: ${stderr}`);

    return stdout.trim().split('\n').filter(Boolean);
  };

  storedS3Config = (container: string, locationId: string) =>
    this.storedRow<S3LocationConfig>(
      container,
      `SELECT s3_config->>'access_key' AS access_key, s3_config->>'secret_key' AS secret_key, s3_config->>'endpoint' AS endpoint, s3_config->>'bucket_name' AS bucket_name FROM backup_locations WHERE id = '${locationId}'`,
    );

  storedValkeyTls = (container: string, serviceId: string) =>
    this.storedRow<ValkeyTlsOptions>(
      container,
      `SELECT valkey_options->>'ssl_ca' AS ssl_ca, valkey_options->>'ssl_cert' AS ssl_cert, valkey_options->>'ssl_key' AS ssl_key FROM agents WHERE service_id = '${serviceId}' AND agent_type = 'valkey_exporter'`,
    );

  private storedRow = <T>(container: string, query: string) => {
    const [row] = this.postgresqlHelper.queryRows<T>(container, query, 'pmm-managed');

    if (!row) throw new Error(`pmm-managed in ${container} has no row for: ${query}`);

    return row;
  };
}
