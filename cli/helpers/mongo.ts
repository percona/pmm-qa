import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { ChangeAgentType, inventoryChangeAgent } from '@helpers/pmm-admin';
import { expect } from '@playwright/test';
import * as cli from './cli-helper';

/**
 * Build the change agent commands applying the same flags to a mongodb_exporter and a QAN mongolog agent
 *
 * @param   containerName   docker container running pmm-agent
 * @param   exporterId      mongodb_exporter agent ID
 * @param   mongologId      mongodb_mongolog_agent agent ID
 * @param   flags           flags to change
 */
export function changeMongoMongologAgents(containerName: string, exporterId: string, mongologId: string, flags: string): string[] {
  return [
    inventoryChangeAgent(containerName, ChangeAgentType.MongodbExporter, exporterId, flags),
    inventoryChangeAgent(containerName, ChangeAgentType.QanMongodbMongologAgent, mongologId, flags),
  ];
}

/**
 * Build the change agent commands applying the same flags to a mongodb_exporter and a QAN profiler agent
 *
 * @param   containerName   docker container running pmm-agent
 * @param   exporterId      mongodb_exporter agent ID
 * @param   profilerId      mongodb_profiler_agent agent ID
 * @param   flags           flags to change
 */
export function changeMongoAgents(containerName: string, exporterId: string, profilerId: string, flags: string): string[] {
  return [
    inventoryChangeAgent(containerName, ChangeAgentType.MongodbExporter, exporterId, flags),
    inventoryChangeAgent(containerName, ChangeAgentType.QanMongodbProfilerAgent, profilerId, flags),
  ];
}

/**
 * Build a command that runs JavaScript with the mongo shell in a container
 *
 * @param   containerName   docker container running mongod
 * @param   mongoUri        connection string
 * @param   js              JavaScript to evaluate; must not contain single quotes
 */
export function mongoEval(containerName: string, mongoUri: string, js: string): string {
  return `docker exec ${containerName} mongo "${mongoUri}" --quiet --eval '${js}'`;
}

/**
 * Run JavaScript with the mongo shell once the container's mongod is a writable primary.
 * Connect with directConnection: replica-set discovery from inside the container resolves the primary to loopback,
 * so an election makes mongosh fail with ECONNREFUSED.
 *
 * @param   containerName   docker container running mongod
 * @param   mongoUri        connection string with directConnection=true
 * @param   js              JavaScript to evaluate; must not contain single quotes
 */
export async function runOnPrimary(containerName: string, mongoUri: string, js: string) {
  await expect(async () => {
    const isPrimary = `if (!db.hello().isWritablePrimary) throw new Error("${containerName} is not primary yet");`;
    await (await cli.exec(mongoEval(containerName, mongoUri, `${isPrimary} ${js}`))).assertSuccess();
  }).toPass({ intervals: [5_000], timeout: 120_000 });
}

/**
 * Wait until the service's mongodb_exporter reports mongodb_up 1
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceName     name of the MongoDB service
 * @param   agentPassword   password of the exporter's /metrics endpoint
 * @param   timeout         milliseconds to wait
 */
export async function expectMongoUp(containerName: string, serviceName: string, agentPassword: string, timeout = 120_000) {
  await expect(async () => {
    const metrics = await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName);

    expect(metrics).toMatch(/^mongodb_up(\{[^}]*\})? 1$/m);
  }).toPass({ intervals: [5_000], timeout });
}

/**
 * Wait until a mongo shell probe succeeds, reporting mongod's journal while it fails
 *
 * @param   containerName   docker container running mongod
 * @param   probe           command that exits 0 once mongod serves
 * @param   timeout         milliseconds to wait
 */
export async function waitForMongod(containerName: string, probe: string, timeout = 120_000) {
  await expect(async () => {
    const output = await cli.exec(probe);
    const journal = output.code === 0 ? '' : (await cli.exec(`docker exec ${containerName} journalctl -u mongod --no-pager -n 20`)).stdout;

    expect(output.code, `mongod is not serving. mongod journal:\n${journal}`).toEqual(0);
  }).toPass({ intervals: [5_000], timeout });
}

/**
 * Manage a root user of the admin database, applying each change on the primary
 *
 * @param   containerName   docker container running mongod
 * @param   mongoUri        connection string with directConnection=true
 * @param   user            user name
 */
export function adminUser(containerName: string, mongoUri: string, user: string) {
  const run = (js: string) => runOnPrimary(containerName, mongoUri, `db.getSiblingDB("admin").${js}`);

  return {
    create: (password: string) => run(`createUser({ user: "${user}", pwd: "${password}", roles: [{ role: "root", db: "admin" }] })`),
    setPassword: (password: string) => run(`changeUserPassword("${user}", "${password}")`),
    drop: () => run(`dropUser("${user}")`),
  };
}

/**
 * Run distinct find queries, each on its own collection and filtering on its own long field name, in parallel mongo
 * shells that all start at the next minute, so the profiler records them in one QAN minute.
 *
 * @param   containerName   docker container running mongod
 * @param   mongoUri        connection string with directConnection=true to the primary
 * @param   database        database to query; its profiler has to record every operation
 * @param   queries         number of distinct queries
 * @param   fieldLength     characters in each field name
 * @param   workers         mongo shells running the queries in parallel
 * @return  when the first shell started and the last one finished
 */
export async function runQueryBurstInOneMinute(containerName: string, mongoUri: string, database: string, queries: number, fieldLength = 20_000, workers = 4) {
  const startAt = Math.ceil((Date.now() + 15_000) / 60_000) * 60_000;
  const dir = mkdtempSync(join(tmpdir(), 'pmm-qa-burst-'));
  const containerDir = `/tmp/${basename(dir)}`;

  try {
    for (let worker = 0; worker < workers; worker++) {
      const from = Math.floor((worker * queries) / workers);
      const to = Math.floor(((worker + 1) * queries) / workers);

      writeFileSync(join(dir, `${worker}.js`), `
        const pad = "A".repeat(${fieldLength});
        const d = db.getSiblingDB("${database}");
        while (Date.now() < ${startAt}) sleep(20);
        const start = new Date();
        for (let i = ${from}; i < ${to}; i++) d["c_" + i].find({ [pad + "_" + i]: 1 }).toArray();
        print(JSON.stringify({ start, end: new Date(), queries: ${to - from} }));
      `);
    }

    await (await cli.exec(`docker cp ${dir} ${containerName}:${containerDir}`)).assertSuccess();
    const output = await cli.exec(`docker exec ${containerName} sh -c 'for f in ${containerDir}/*.js; do mongo "${mongoUri}" --quiet "$f" & done; wait'`);
    const results = output.getStdOutLines().filter((line) => line.startsWith('{')).map((line) => JSON.parse(line) as { start: string, end: string, queries: number });

    expect(results.reduce((sum, result) => sum + result.queries, 0), `Not every mongo shell finished its queries: ${output.stdout}${output.stderr.text}`).toEqual(queries);

    return {
      start: new Date(Math.min(...results.map((result) => Date.parse(result.start)))),
      end: new Date(Math.max(...results.map((result) => Date.parse(result.end)))),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await cli.exec(`docker exec ${containerName} rm -rf ${containerDir}`);
  }
}
