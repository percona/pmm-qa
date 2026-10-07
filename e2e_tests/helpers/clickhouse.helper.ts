import { expect, test } from '@playwright/test';
import CliHelper from '@helpers/cli.helper';

export type ClickHouseProfile = 'default' | 'low-memory';

interface ClickHouseSetting {
  changed: number;
  value: string;
}

export const clickHouseConfigDir = '/etc/clickhouse-server';

const serverSettings: Record<ClickHouseProfile, Record<string, string>> = {
  default: {
    concurrent_threads_soft_limit_num: '0',
    mark_cache_size: '5368709120',
    max_server_memory_usage_to_ram_ratio: '0.75',
    uncompressed_cache_size: '8589934592',
  },
  'low-memory': {
    concurrent_threads_soft_limit_num: '1',
    mark_cache_size: '536870912',
    max_server_memory_usage_to_ram_ratio: '0.5',
    uncompressed_cache_size: '2147483648',
  },
};
// default-users.xml leaves these at the ClickHouse defaults, which move between ClickHouse releases,
// so the default profile is checked for not overriding them rather than for their values.
const lowMemoryQuerySettings: Record<string, string> = {
  input_format_parallel_parsing: '0',
  max_block_size: '8192',
  max_download_threads: '1',
  output_format_parallel_formatting: '0',
};

export default class ClickHouseHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  countQanRows = (containerName: string) =>
    Number(this.query(containerName, 'SELECT count() FROM pmm.metrics').stdout.trim());

  query = (containerName: string, query: string) =>
    this.cliHelper
      .execSilent(`docker exec ${containerName} clickhouse-client --password clickhouse --query "${query}"`)
      .assertSuccess();

  readSettings = (
    containerName: string,
    table: 'server_settings' | 'settings',
    names: string[],
  ): Record<string, ClickHouseSetting> => {
    const output = this.query(
      containerName,
      `SELECT name, value, changed FROM system.${table} WHERE name IN ('${names.join("', '")}') FORMAT JSONEachRow`,
    );

    return Object.fromEntries(
      output.getStdOutLines().map((line) => {
        const { changed, name, value } = JSON.parse(line) as ClickHouseSetting & { name: string };

        return [name, { changed, value }];
      }),
    );
  };

  verifyProfile = async (containerName: string, profile: ClickHouseProfile) => {
    await test.step(`Verify ClickHouse runs the ${profile} configuration`, async () => {
      // readlink also exits non-zero when a link has been replaced by a regular file, which is the
      // state in which PMM_CLICKHOUSE_CONFIG is silently ignored.
      for (const file of ['config', 'users']) {
        const link = this.cliHelper
          .execSilent(`docker exec ${containerName} readlink ${clickHouseConfigDir}/${file}.xml`)
          .assertSuccess();

        expect(
          link.stdout.trim(),
          `${file}.xml should point at the ${profile} ClickHouse configuration`,
        ).toEqual(`${clickHouseConfigDir}/${profile}-${file}.xml`);
      }

      const settings = this.readSettings(
        containerName,
        'server_settings',
        Object.keys(serverSettings[profile]),
      );

      expect(
        Object.fromEntries(Object.entries(settings).map(([name, setting]) => [name, setting.value])),
        `ClickHouse should run with the ${profile} server settings`,
      ).toEqual(serverSettings[profile]);

      const querySettings = this.readSettings(containerName, 'settings', Object.keys(lowMemoryQuerySettings));

      if (profile === 'low-memory') {
        expect(
          Object.fromEntries(Object.entries(querySettings).map(([name, setting]) => [name, setting.value])),
          'ClickHouse should run queries with the low-memory settings',
        ).toEqual(lowMemoryQuerySettings);
      } else {
        expect(
          Object.fromEntries(Object.entries(querySettings).map(([name, setting]) => [name, setting.changed])),
          'ClickHouse should run queries with its own default settings',
        ).toEqual(Object.fromEntries(Object.keys(lowMemoryQuerySettings).map((name) => [name, 0])));
      }
    });
  };
}
