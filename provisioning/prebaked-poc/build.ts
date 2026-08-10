import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATABASES, type DatabaseType } from '../setup.ts';
import { normalizeEngine } from './lib/engines.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));

const mysqlImages = {
  '5.7': 'mysql:5.7',
  '8.0': 'mysql:8.0',
  '8.4': 'mysql:8.4',
  '9.7': 'mysql:9.7',
} as const;

const psImages = {
  '5.7': ['percona/percona-server:5.7', 'percona-xtrabackup-24'],
  '8.0': ['percona/percona-server:8.0.46', 'percona-xtrabackup-80'],
  '8.4': ['percona/percona-server:8.4.10', 'percona-xtrabackup-84'],
} as const;

export function dockerBuildArgs(descriptor: string): string[] {
  const [head, ...entries] = descriptor.split(',');
  const [engine, requestedVersion, extra] = head.split('=');
  if (!engine || requestedVersion === '' || extra !== undefined) {
    throw new Error('usage: npm run build -- <engine>[=<version>]');
  }
  const normalizedEngine = normalizeBuildEngine(engine);
  const options = Object.fromEntries(entries.map((entry) => {
    const [key, value, unexpected] = entry.split('=');
    if (!key || !value || unexpected !== undefined) throw new Error(`invalid build option: ${entry}`);
    return [key.toLowerCase(), value];
  }));
  if (normalizedEngine !== 'psmdb' && entries.length) throw new Error(`${normalizedEngine} has no build options`);
  if (Object.keys(options).some((key) => key !== 'ol-version')) throw new Error('PSMDB build supports only ol-version');
  const version = normalizedEngine === 'psmdb' && requestedVersion === 'latest'
    ? '8.0'
    : requestedVersion ?? DATABASES[normalizedEngine].defaultVersion;
  if (normalizedEngine === 'mysql') {
    const image = mysqlImages[version as keyof typeof mysqlImages];
    if (!image) throw new Error('version must be 5.7, 8.0, 8.4, or 9.7');
    const args = [
      'build',
      '-f',
      'engines/mysql/Dockerfile',
      '--target',
      version === '5.7' ? 'prebaked-57' : 'prebaked-epel',
      '-t',
      `pmm-qa/mysql:${version}-prebaked`,
      '.',
    ];
    if (version !== '5.7') args.push('--build-arg', `MYSQL_IMAGE=${image}`);
    return args;
  }

  if (normalizedEngine === 'ps') {
    const image = psImages[version as keyof typeof psImages];
    if (!image) throw new Error('version must be 5.7, 8.0, or 8.4');
    return [
      'build',
      '-f',
      'engines/ps/Dockerfile',
      '--build-arg',
      `PS_IMAGE=${image[0]}`,
      '--build-arg',
      `XTRABACKUP_PACKAGE=${image[1]}`,
      '-t',
      `pmm-qa/ps:${version}-prebaked`,
      '.',
    ];
  }

  if (normalizedEngine === 'pxc') {
    if (version !== '5.7' && version !== '8.0') throw new Error('version must be 5.7 or 8.0');
    return [
      'build', '-f', 'engines/pxc/Dockerfile', '--build-arg',
      `PXC_IMAGE=percona/percona-xtradb-cluster:${version}`,
      '-t', `pmm-qa/pxc:${version}-prebaked`, 'engines/pxc',
    ];
  }

  if (normalizedEngine === 'psmdb') {
    if (!['6.0', '7.0', '8.0'].includes(version)) throw new Error('version must be 6.0, 7.0, or 8.0');
    const olVersion = options['ol-version'] ?? '9';
    if (!['8', '9'].includes(olVersion)) throw new Error('ol-version must be 8 or 9');
    const tagSuffix = options['ol-version'] ? `-ol${olVersion}` : '';
    return [
      'build',
      '-f',
      'engines/psmdb/Dockerfile',
      '--build-arg',
      `PSMDB_VERSION=${version}`,
      '--build-arg',
      `OL_VERSION=${olVersion}`,
      '-t',
      `pmm-qa/psmdb:${version}${tagSuffix}-prebaked`,
      'engines/psmdb',
    ];
  }

  if (normalizedEngine === 'mongodb') {
    if (!['6.0', '7.0', '8.0'].includes(version)) throw new Error('version must be 6.0, 7.0, or 8.0');
    return [
      'build', '-f', 'engines/mongodb/Dockerfile', '--build-arg', `MONGODB_VERSION=${version}`,
      '-t', `pmm-qa/mongodb:${version}-prebaked`, 'engines',
    ];
  }

  if (normalizedEngine === 'pgsql') {
    if (!['16', '17', '18'].includes(version)) throw new Error('version must be 16, 17, or 18');
    return [
      'build', '-f', 'engines/pgsql/Dockerfile', '--build-arg', `PGSQL_VERSION=${version}`,
      '-t', `pmm-qa/pgsql:${version}-prebaked`, 'engines/pgsql',
    ];
  }

  if (normalizedEngine === 'valkey') {
    if (version !== '7' && version !== '8') throw new Error('version must be 7 or 8');
    return [
      'build', '-f', 'engines/valkey/Dockerfile', '--build-arg', `VALKEY_VERSION=${version}`,
      '-t', `pmm-qa/valkey:${version}-prebaked`, 'engines/valkey',
    ];
  }

  if (normalizedEngine === 'haproxy' || normalizedEngine === 'external') {
    if (version !== 'latest') throw new Error(`${normalizedEngine} has no version selector`);
    return [
      'build', '-f', 'engines/services/Dockerfile',
      '-t', `pmm-qa/${normalizedEngine}:latest-prebaked`, 'engines/services',
    ];
  }

  if (normalizedEngine === 'bucket') {
    if (version !== 'latest') throw new Error('bucket has no version selector');
    return ['build', '-f', 'engines/minio/Dockerfile', '-t', 'pmm-qa/bucket:latest-prebaked', 'engines/minio'];
  }

  if (!['16', '17', '18'].includes(version)) throw new Error('version must be 16, 17, or 18');
  return [
    'build',
    '-f',
    'engines/pdpgsql/Dockerfile',
    '--build-arg',
    `PDPGSQL_VERSION=${version}`,
    '-t',
    `pmm-qa/pdpgsql:${version}-prebaked`,
    'engines/pdpgsql',
  ];
}

export function proxyBuildArgs(): string[] {
  return [
    'build', '-f', 'engines/pxc/proxy/Dockerfile',
    '-t', 'pmm-qa/proxysql:2-prebaked', 'engines/pxc',
  ];
}

function normalizeBuildEngine(value: string | undefined): DatabaseType {
  if (!value) throw new Error('usage: npm run build -- <engine> <version>');
  const normalized = value.toLowerCase();
  if (normalized in DATABASES) return normalized as DatabaseType;
  return normalizeEngine(normalized, {});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[3]) throw new Error('usage: npm run build -- <engine>[=<version>]');
    const descriptor = process.argv[2] ?? '';
    const result = spawnSync('docker', dockerBuildArgs(descriptor), {
      stdio: 'inherit',
      cwd: ROOT,
    });
    process.exitCode = result.status ?? 1;
    const engine = descriptor.split('=', 1)[0].toLowerCase();
    if (result.status === 0 && engine === 'pxc') {
      process.exitCode = spawnSync(
        'docker',
        proxyBuildArgs(),
        { stdio: 'inherit', cwd: ROOT },
      ).status ?? 1;
    }
    if (result.status === 0 && engine === 'psmdb') {
      process.exitCode = spawnSync(
        'docker',
        ['build', '-t', 'pmm-qa/kerberos:prebaked', 'engines/psmdb/kerberos'],
        { stdio: 'inherit', cwd: ROOT },
      ).status ?? 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
