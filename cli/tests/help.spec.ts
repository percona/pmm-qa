import { test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import ExecReturn from '@support/types/exec-return.class';

let addMongoHelp: ExecReturn;
let addPostgreSqlHelp: ExecReturn;

test.describe('PMM Client "--help" validation', { tag: '@help' }, async () => {
  test.beforeAll(async ({}) => {
    const result1 = await cli.exec('sudo pmm-admin status');
    await result1.outContains('Running', 'pmm-client is not installed/connected locally, please run pmm3-client-setup script');
  });

  test('pmm-admin mongodb --help check', async ({}) => {
    addMongoHelp = await cli.execSilent('sudo pmm-admin add mongodb --help');
    await addMongoHelp.assertSuccess();
    addPostgreSqlHelp = await cli.execSilent('sudo pmm-admin add postgresql --help');
    await addPostgreSqlHelp.assertSuccess();
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/modb-tests.bats#L182
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/modb-tests.bats#L191
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/modb-tests.bats#L198
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/modb-tests.bats#L205
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/modb-tests.bats#L212
   */
  test('pmm-admin mongodb --help validation', async ({}) => {
    await addMongoHelp.outContainsMany([
      'Usage: pmm-admin add mongodb [<name> [<address>]]',
      '--socket=STRING',
      'metrics-mode="auto"',
      'host',
      'port',
      'service-name',
    ]);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/modb-tests.bats#L287
   */
  test('PMM-T925 Verify pmm-admin add mongodb --help has TLS-related flags', async ({}) => {
    await addMongoHelp.outContainsMany([
      'tls                        Use TLS to connect to the database',
      'tls-skip-verify            Skip TLS certificate verification',
      'tls-certificate-key-file=STRING',
      'tls-certificate-key-file-password=STRING',
      'tls-ca-file=STRING         Path to certificate authority file',
      'authentication-mechanism=STRING',
      'authentication-database=STRING',
    ]);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L112
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L119
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L126
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L133
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L140
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L147
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L154
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L161
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L168
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L175
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L182
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L189
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L196
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L203
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L210
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L217
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L224
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L231
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L238
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L245
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L252
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L259
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L69
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L76
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L83
   */
  test('PMM-T443 Verify pmm-admin add postgresql --help', async ({}) => {
    await addPostgreSqlHelp.outContainsMany([
      'version',
      'metrics-mode="auto"',
      'server-url=SERVER-URL',
      'server-insecure-tls',
      'debug',
      'trace',
      'json',
      'socket=STRING',
      'node-id=STRING',
      'pmm-agent-id=STRING',
      'username="postgres"',
      'password=STRING',
      'query-source="pgstatmonitor"',
      'environment=STRING',
      'cluster=STRING',
      'replication-set=STRING',
      'custom-labels=KEY=VALUE,...',
      'skip-connection-check',
      'disable-queryexamples',
      'database=STRING            PostgreSQL database',
      'host',
      'port',
      'service-name',
    ]);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pdpgsql-tests.bats#L333
   */
  test('PMM-T945 - Verify help for pmm-admin add postgresql has TLS-related flags', async ({}) => {
    await addPostgreSqlHelp.outContainsMany([
      'tls                        Use TLS to connect to the database',
      'tls-skip-verify            Skip TLS certificate verification',
      'tls-cert-file=STRING       TLS certificate file',
      'tls-key-file=STRING        TLS certificate key file',
      'tls-ca-file=STRING         TLS CA certificate file',
    ]);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L312
   */
  test('run pmm-admin annotate --help', async ({}) => {
    const output = await cli.execSilent('sudo pmm-admin annotate --help');
    await output.assertSuccess();
    await output.outContainsMany([
      'Usage: pmm-admin annotate <text>',
      '<text>    Text of annotation',
      'Add an annotation to Grafana charts',
    ]);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L335
   */
  test('run pmm-admin --help to check if Annotation exist in help output', async ({}) => {
    const output = await cli.execSilent('sudo pmm-admin --help');
    await output.assertSuccess();
    await output.outContains('annotate Add an annotation to Grafana charts');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L356
   */
  test('run pmm-admin config --help to check for Metrics Mode option', async ({}) => {
    const output = await cli.execSilent('sudo pmm-admin config --help');
    await output.assertSuccess();
    await output.outContainsMany([
      'Metrics flow mode, can be push - agent will',
      'push metrics, pull - server scrape metrics from',
      'agent or auto - chosen by server',
    ]);
  });

  test('PMM-T1827 - Verify there is --auto-discovery-limit option in pmm-admin add postgresql help output', async ({}) => {
    await addPostgreSqlHelp.outContainsMany([
      'Auto-discovery will be disabled if there are',
      'more than that number of databases (default:',
      'server-defined, -1: always disabled)',
    ]);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L77
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L162
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ps-specific-tests.bats#L137
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ps-specific-tests.bats#L144
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ps-specific-tests.bats#L123
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ps-specific-tests.bats#L130
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ps-specific-tests.bats#L151
   */
  test('PMM-T959 run pmm-admin add mysql --help', async ({ }) => {
    const output = await cli.exec('sudo pmm-admin add mysql --help');
    await output.assertSuccess();
    await output.outContainsMany([
      'help',
      'server-url=SERVER-URL',
      'server-insecure-tls',
      'debug',
      'trace',
      'pmm-agent-listen-port=7777',
      'json',
      'version',
      'socket=STRING',
      'node-id=STRING',
      'pmm-agent-id=STRING',
      'username="root"',
      'password=STRING',
      'agent-password=STRING',
      'query-source="slowlog"',
      'max-query-length=NUMBER',
      'disable-queryexamples',
      'size-slow-logs=size',
      'disable-tablestats',
      'disable-tablestats-limit=NUMBER',
      'environment=STRING',
      'cluster=STRING',
      'replication-set=STRING',
      'custom-labels=KEY=VALUE,...',
      'skip-connection-check',
      'tls',
      'tls-skip-verify',
      'tls-ca=STRING',
      'tls-cert=STRING',
      'tls-key=STRING',
      'metrics-mode="auto"',
      'disable-collectors=DISABLE-COLLECTORS,',
      'service-name=NAME',
      'host=HOST',
      'port=PORT',
      'log-level="warn"',
    ]);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ps-specific-tests.bats#L392
   * TODO: merge with previous test
   */
  test('PMM-T789 - Verify help for pmm-admin add mysql has TLS-related flags', async ({ }) => {
    const output = await cli.exec('sudo pmm-admin add mysql --help');
    await output.assertSuccess();
    await output.outContainsNormalizedMany([
      'tls Use TLS to connect to the database',
      'tls-skip-verify Skip TLS certificate verification',
      'tls-ca=STRING Path to certificate authority certificate',
      'tls-cert=STRING Path to client certificate file',
      'tls-key=STRING Path to client key file',
    ]);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L31
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L45
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L52
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L59
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L59
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L66
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L73
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L80
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L87
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L94
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L101
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L108
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L115
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L122
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L129
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L136
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L143
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L150
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L157
   */
  test('PMM-T674 - Verify help for adding HAProxy service', async ({}) => {
    const output = await cli.exec('sudo pmm-admin add haproxy --help');
    await output.assertSuccess();
    await output.outContainsMany([
      'help',
      'version',
      'server-url=SERVER-URL',
      'server-insecure-tls',
      'debug',
      'trace',
      'json',
      'username=STRING',
      'password=STRING',
      'scheme=http or https',
      'metrics-path=/metrics',
      'listen-port=port',
      'node-id=STRING ',
      'environment=prod',
      'cluster=east-cluster',
      'replication-set=rs1',
      'custom-labels=KEY=VALUE,...',
      'metrics-mode="auto"',
      'skip-connection-check',
    ]);
  });
});
