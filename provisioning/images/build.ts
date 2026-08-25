import { spawnSync } from 'node:child_process';
import { CONTAINER_RUNTIME } from '../pmm-client.ts';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATABASES, databaseSuffix, type DatabaseType } from '../setup.ts';
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

const SIMPLE_ENGINE_BUILDS: Record<string, { versions: string[]; arg: string; context: string }> = {
  mongodb: { versions: ['6.0', '7.0', '8.0'], arg: 'MONGODB_VERSION', context: 'engines' },
  pgsql: { versions: ['14', '15', '16', '17', '18'], arg: 'PGSQL_VERSION', context: 'engines/pgsql' },
  valkey: { versions: ['7', '8'], arg: 'VALKEY_VERSION', context: 'engines/valkey' },
};

export function dockerBuildArgs(
  descriptor: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
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
  if (normalizedEngine !== 'psmdb' && normalizedEngine !== 'pdpgsql' && normalizedEngine !== 'pxc' && entries.length) throw new Error(`${normalizedEngine} has no build options`);
  if (normalizedEngine === 'psmdb' && Object.keys(options).some((key) => !['ol-version', 'patch'].includes(key))) throw new Error('PSMDB build supports only ol-version and patch');
  if (normalizedEngine === 'pdpgsql' && Object.keys(options).some((key) => key !== 'pgsm-branch')) throw new Error('PDPGSQL build supports only pgsm-branch');
  if (normalizedEngine === 'pxc' && Object.keys(options).some((key) => !['image', 'tarball'].includes(key))) throw new Error('PXC build supports only image and tarball');
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
      version === '5.7' ? 'mysql-57' : 'mysql-epel',
      '-t',
      `pmm-qa/mysql:${version}`,
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
      `pmm-qa/ps:${version}`,
      '.',
    ];
  }

  if (normalizedEngine === 'pxc') {
    if (version !== '5.7' && version !== '8.0') throw new Error('version must be 5.7 or 8.0');
    // tarball= overlays a pre-release binary tarball (pmm-framework's PXC_TARBALL);
    // image= builds against a different base image instead. See ARCHITECTURE.md.
    const args = [
      'build', '-f', 'engines/pxc/Dockerfile', '--build-arg',
      `PXC_IMAGE=${options.image ?? `percona/percona-xtradb-cluster:${version}`}`,
    ];
    if (options.tarball) args.push('--build-arg', `PXC_TARBALL=${options.tarball}`);
    args.push('-t', `pmm-qa/pxc:${version}${databaseSuffix({ type: 'pxc', version, options })}`, 'engines/pxc');
    return args;
  }

  if (normalizedEngine === 'psmdb') {
    if (!['6.0', '7.0', '8.0'].includes(version)) throw new Error('version must be 6.0, 7.0, or 8.0');
    const olVersion = options['ol-version'] ?? '9';
    if (!['8', '9'].includes(olVersion)) throw new Error('ol-version must be 8 or 9');
    const tagSuffix = databaseSuffix({ type: 'psmdb', version, options });
    // patch= pins a full PSMDB release (8.0.4-1), replacing pmm-framework's downloads-API lookup.
    const patch = options.patch ?? '';
    if (patch && !patch.startsWith(`${version}.`)) throw new Error(`patch must be a ${version}.x release`);
    return [
      'build',
      '-f',
      'engines/psmdb/Dockerfile',
      '--build-arg',
      `PSMDB_VERSION=${version}`,
      '--build-arg',
      `PSMDB_PATCH=${patch}`,
      '--build-arg',
      `OL_VERSION=${olVersion}`,
      '-t',
      `pmm-qa/psmdb:${version}${tagSuffix}`,
      'engines/psmdb',
    ];
  }

  if (normalizedEngine in SIMPLE_ENGINE_BUILDS) {
    const spec = SIMPLE_ENGINE_BUILDS[normalizedEngine];
    if (!spec.versions.includes(version)) {
      const choices = spec.versions.length === 2 ? spec.versions.join(' or ') : `${spec.versions.slice(0, -1).join(', ')}, or ${spec.versions.at(-1)}`;
      throw new Error(`version must be ${choices}`);
    }
    return [
      'build', '-f', `engines/${normalizedEngine}/Dockerfile`, '--build-arg', `${spec.arg}=${version}`,
      '-t', `pmm-qa/${normalizedEngine}:${version}`, spec.context,
    ];
  }

  if (normalizedEngine === 'haproxy' || normalizedEngine === 'external') {
    if (version !== 'latest') throw new Error(`${normalizedEngine} has no version selector`);
    const args = ['build', '-f', 'engines/services/Dockerfile'];
    // pmm-framework's REDIS_VERSION / NODE_PROCESS_VERSION, honoured at build time.
    if (env.REDIS_VERSION) args.push('--build-arg', `REDIS_EXPORTER_VERSION=${env.REDIS_VERSION}`);
    if (env.NODE_PROCESS_VERSION) args.push('--build-arg', `PROCESS_EXPORTER_VERSION=${env.NODE_PROCESS_VERSION}`);
    args.push('-t', `pmm-qa/${normalizedEngine}:latest`, 'engines/services');
    return args;
  }

  if (normalizedEngine === 'bucket') {
    if (version !== 'latest') throw new Error('bucket has no version selector');
    return ['build', '-f', 'engines/minio/Dockerfile', '-t', 'pmm-qa/bucket:latest', 'engines/minio'];
  }

  if (normalizedEngine === 'mlaunch-psmdb' || normalizedEngine === 'mlaunch-mongodb') {
    if (!['6.0', '7.0', '8.0'].includes(version)) throw new Error('version must be 6.0, 7.0, or 8.0');
    const flavor = normalizedEngine === 'mlaunch-psmdb' ? 'psmdb' : 'mongodb';
    return [
      'build',
      '-f',
      'engines/mlaunch/Dockerfile',
      '--build-arg',
      `MLAUNCH_ENGINE=${flavor}`,
      '--build-arg',
      `MONGO_VERSION=${version}`,
      '-t',
      `pmm-qa/${normalizedEngine}:${version}`,
      'engines/mlaunch',
    ];
  }

  if (!['14', '15', '16', '17', '18'].includes(version)) throw new Error('version must be 14, 15, 16, 17, or 18');
  const args = [
    'build',
    '-f',
    'engines/pdpgsql/Dockerfile',
    '--build-arg',
    `PDPGSQL_VERSION=${version}`,
  ];
  if (options['pgsm-branch']) args.push('--build-arg', `PGSM_BRANCH=${options['pgsm-branch']}`);
  args.push('-t', `pmm-qa/pdpgsql:${version}`, 'engines/pdpgsql');
  return args;
}

export function proxyBuildArgs(): string[] {
  return [
    'build', '-f', 'engines/pxc/proxy/Dockerfile',
    '-t', 'pmm-qa/proxysql:2', 'engines/pxc',
  ];
}

function normalizeBuildEngine(value: string | undefined): DatabaseType {
  if (!value) throw new Error('usage: npm run build -- <engine> <version>');
  const normalized = value.toLowerCase();
  if (normalized in DATABASES) return normalized as DatabaseType;
  return normalizeEngine(normalized, {});
}

if (import.meta.main) {
  try {
    if (process.argv[3]) throw new Error('usage: npm run build -- <engine>[=<version>]');
    const descriptor = process.argv[2] ?? '';
    const result = spawnSync(CONTAINER_RUNTIME, dockerBuildArgs(descriptor), {
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
        ['build', '-t', 'pmm-qa/kerberos:latest', 'engines/psmdb/kerberos'],
        { stdio: 'inherit', cwd: ROOT },
      ).status ?? 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
