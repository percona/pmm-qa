import { Client, ClientConfig } from 'pg';
import { expect } from '@playwright/test';
import { Timeouts } from './timeouts';

interface PostgreSqlConfig {
  database?: string;
  host?: string;
  password: string;
  port: number;
  username: string;
}

interface Session {
  client: Client;
  pid: number;
}

const lockTable = 'rta_qa_lock_target';
const parallelTable = 'rta_qa_parallel_target';
const slowRowFunction = 'rta_qa_slow_row';

export default class PostgreSQLHelper {
  readonly applicationName = 'pmm-qa-rta';
  private closed = false;
  private config: ClientConfig;
  private sessions: Session[] = [];

  constructor(config: PostgreSqlConfig) {
    this.config = {
      application_name: this.applicationName,
      connectionTimeoutMillis: Timeouts.THIRTY_SECONDS,
      database: config.database ?? 'postgres',
      host: config.host ?? '127.0.0.1',
      password: config.password,
      port: config.port,
      user: config.username,
    };
  }

  close = async () => {
    this.closed = true;

    if (this.sessions.length === 0) {
      return;
    }

    // Terminated on the server, so their queries and locks do not linger in the next test's RTA view.
    const admin = new Client(this.config);

    await admin.connect();
    await admin
      .query('SELECT pg_terminate_backend(pid) FROM unnest($1::int[]) AS pid', [
        this.sessions.map(({ pid }) => pid),
      ])
      .catch(() => undefined);
    await admin.end();

    for (const { client } of this.sessions) {
      await client.end().catch(() => undefined);
    }

    this.sessions = [];
  };

  createLoginRole = async (role: string, password: string) => {
    const { client } = await this.openSession();

    await client.query(`DROP ROLE IF EXISTS ${client.escapeIdentifier(role)}`);
    await client.query(
      `CREATE ROLE ${client.escapeIdentifier(role)} LOGIN PASSWORD ${client.escapeLiteral(password)}`,
    );
  };

  dropRole = async (role: string) => {
    const { client } = await this.openSession();

    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = $1 AND pid <> pg_backend_pid()',
      [role],
    );
    await client.query(`DROP ROLE IF EXISTS ${client.escapeIdentifier(role)}`);
  };

  /**
   * Holds a transaction open, idle after `SELECT <queryLabel>`, with its last statement run openForMs after
   * BEGIN, so the transaction is that much older than its last statement. Returns the backend pid.
   */
  holdIdleTransaction = async (queryLabel: string, openForMs: number) => {
    const { client, pid } = await this.openSession();

    await client.query('BEGIN');
    await client.query('SELECT pg_sleep($1)', [openForMs / 1_000]);
    await client.query(`SELECT ${client.escapeLiteral(queryLabel)} AS label`);

    return pid;
  };

  queryIdOf = async (pid: number) => {
    const { client } = await this.openSession();
    let queryId = '';

    await expect
      .poll(
        async () => {
          const { rows } = await client.query<{ query_id: null | string }>(
            'SELECT query_id::text FROM pg_stat_activity WHERE pid = $1',
            [pid],
          );

          queryId = rows[0]?.query_id ?? '';

          return queryId;
        },
        { message: `query_id of backend ${pid} must be computed`, timeout: Timeouts.TEN_SECONDS },
      )
      .not.toBe('');

    return queryId;
  };

  /**
   * Holds an advisory lock in a session left idle outside any transaction, and starts a labelled
   * statement that waits for it.
   */
  simulateAdvisoryLockWait = async (queryLabel: string, lockKey: number) => {
    const holder = await this.openSession();
    const waiter = await this.openSession();

    await holder.client.query('SELECT pg_advisory_lock($1)', [lockKey]);
    this.runInBackground(
      waiter.client,
      `SELECT ${waiter.client.escapeLiteral(queryLabel)} AS label, pg_advisory_lock(${lockKey})`,
    );
    await this.waitForLockWait(waiter.pid);

    return { holder: holder.pid, waiter: waiter.pid };
  };

  /**
   * Starts `SELECT <queryLabel>, pg_sleep(<delay>)` so the labelled query stays in pg_stat_activity, and
   * returns its backend pid. It ends after the delay or when close() terminates it.
   */
  simulateLongRunningQuery = async (
    options: { computeQueryId?: boolean; delayMs?: number; minLength?: number; queryLabel?: string } = {},
  ) => {
    const { computeQueryId = false, delayMs = Timeouts.TEN_SECONDS, minLength = 0, queryLabel } = options;
    const { client, pid } = await this.openSession();
    const query = `SELECT ${client.escapeLiteral(queryLabel ?? 'rta-simulated-query')} AS label, pg_sleep(${Math.ceil(delayMs / 1_000)})`;
    // A trailing comment pads the text past track_activity_query_size without changing what runs.
    const padding = query.length < minLength ? ` /* ${'x'.repeat(minLength - query.length)} */` : '';

    if (computeQueryId) {
      await client.query('SET compute_query_id = on');
    }

    this.runInBackground(client, query + padding);

    return pid;
  };

  /**
   * Starts a labelled parallel scan whose rows each take 10 ms, so its workers stay in pg_stat_activity
   * beside the leader. Returns the leader pid once at least one worker runs.
   */
  simulateParallelQuery = async (queryLabel: string) => {
    const setup = await this.openSession();
    const leader = await this.openSession();

    await setup.client.query(
      `CREATE TABLE IF NOT EXISTS ${parallelTable} AS SELECT generate_series(1, 6000) AS id`,
    );
    await setup.client.query(`ANALYZE ${parallelTable}`);
    await setup.client.query(
      `CREATE OR REPLACE FUNCTION ${slowRowFunction}(int) RETURNS boolean LANGUAGE plpgsql PARALLEL SAFE
        AS $$ BEGIN PERFORM pg_sleep(0.01); RETURN true; END $$`,
    );

    for (const setting of [
      'max_parallel_workers_per_gather = 2',
      'parallel_setup_cost = 0',
      'parallel_tuple_cost = 0',
      'min_parallel_table_scan_size = 0',
    ]) {
      await leader.client.query(`SET ${setting}`);
    }

    this.runInBackground(
      leader.client,
      `SELECT ${leader.client.escapeLiteral(queryLabel)} AS label, count(*) FROM ${parallelTable} WHERE ${slowRowFunction}(id)`,
    );

    await expect
      .poll(
        async () => {
          const { rows } = await setup.client.query<{ workers: number }>(
            "SELECT count(*)::int AS workers FROM pg_stat_activity WHERE leader_pid = $1 AND backend_type = 'parallel worker'",
            [leader.pid],
          );

          return rows[0].workers;
        },
        {
          message: `backend ${leader.pid} must run its query with parallel workers`,
          timeout: Timeouts.TEN_SECONDS,
        },
      )
      .toBeGreaterThan(0);

    return leader.pid;
  };

  /**
   * Holds a row lock in a transaction left idle, then queues two labelled UPDATEs of the same row behind it,
   * the second starting once the first waits.
   */
  simulateRowLockChain = async (queryLabel: string) => {
    const holder = await this.openSession();
    const waiters = [await this.openSession(), await this.openSession()];
    const update = `UPDATE ${lockTable} SET v = v + 1 WHERE id = 1`;

    await holder.client.query(`CREATE TABLE IF NOT EXISTS ${lockTable} (id int PRIMARY KEY, v int NOT NULL)`);
    await holder.client.query(`INSERT INTO ${lockTable} VALUES (1, 0) ON CONFLICT (id) DO NOTHING`);
    await holder.client.query('BEGIN');
    await holder.client.query(`/* ${queryLabel}-holder */ ${update}`);

    for (const [index, waiter] of waiters.entries()) {
      this.runInBackground(waiter.client, `/* ${queryLabel}-waiter-${index + 1} */ ${update}`);
      await this.waitForLockWait(waiter.pid);
    }

    return { holder: holder.pid, waiters: waiters.map(({ pid }) => pid) };
  };

  trackActivityQuerySize = async () => {
    const { client } = await this.openSession();
    const { rows } = await client.query<{ size: number }>(
      "SELECT setting::int AS size FROM pg_settings WHERE name = 'track_activity_query_size'",
    );

    return rows[0].size;
  };

  private ignoreAfterClose = (error: unknown) => {
    if (!this.closed) {
      console.log(`PostgreSQLHelper query ended early: ${String(error)}`);
    }
  };

  private openSession = async (): Promise<Session> => {
    if (this.closed) {
      throw new Error('PostgreSQLHelper is closed');
    }

    const client = new Client(this.config);

    // pg emits 'error' on a client whose backend close() terminates; unhandled, it would end the run.
    client.on('error', this.ignoreAfterClose);
    await client.connect();

    const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const session = { client, pid: rows[0].pid };

    this.sessions.push(session);

    return session;
  };

  private runInBackground = (client: Client, query: string) => {
    void client.query(query).catch(this.ignoreAfterClose);
  };

  private waitForLockWait = async (pid: number) => {
    const { client } = await this.openSession();

    await expect
      .poll(
        async () => {
          const { rows } = await client.query<{ wait_event_type: null | string }>(
            'SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1',
            [pid],
          );

          return rows[0]?.wait_event_type;
        },
        { message: `backend ${pid} must be waiting for a lock`, timeout: Timeouts.TEN_SECONDS },
      )
      .toBe('Lock');
  };
}
