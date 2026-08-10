import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { docker, ensureDockerNetwork, requireDockerImage, retry, step } from '../../../pmm-client.ts';

export interface Config { image: string; buckets: string[]; }
const NETWORK = 'pmm-qa';
const NAME = 'pmm-qa-minio';

export function parseConfig(argv: string[] = process.argv.slice(2)): Config {
  const { values } = parseArgs({ args: argv, strict: true, options: {
    image: { type: 'string' }, buckets: { type: 'string' },
  }});
  const buckets = (values.buckets ?? 'bcp').split(';').map((value) => value.trim()).filter(Boolean);
  if (!buckets.length || buckets.some((bucket) => !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))) {
    throw new Error('buckets must be semicolon-separated valid S3 bucket names');
  }
  return { image: values.image ?? 'pmm-qa/minio:latest-prebaked', buckets };
}

async function main(): Promise<void> {
  const config = parseConfig();
  await step('Check prebaked image', () => requireDockerImage(config.image, 'npm run build -- minio'));
  await step('Prepare Docker network', () => ensureDockerNetwork(NETWORK));
  await docker(['rm', '-f', NAME], true);
  await step('Start MinIO', () => docker(['run', '--detach', '--name', NAME, '--label', 'pmm-qa.poc=minio-prebaked', '--network', NETWORK,
    '--env', 'MINIO_ROOT_USER=minioadmin', '--env', 'MINIO_ROOT_PASSWORD=minioadmin',
    config.image, 'server', '/data', '--console-address', ':9001']));
  await retry('MinIO', () => docker(['exec', NAME, 'curl', '-fsS', 'http://127.0.0.1:9000/minio/health/live'], true), (result) => result.stdout.length === 0 && result.stderr.length === 0);
  await step('Create buckets', () => docker(['run', '--rm', '--network', NETWORK, 'minio/mc:latest', 'sh', '-ceu',
    `mc alias set local http://${NAME}:9000 minioadmin minioadmin; ${config.buckets.map((bucket) => `mc mb --ignore-existing local/${bucket}`).join('; ')}`]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
