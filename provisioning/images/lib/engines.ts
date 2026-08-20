export type Engine = 'mysql' | 'ps';
export type SetupType = 'single' | 'replication' | 'gr';
export type QuerySource = 'perfschema' | 'slowlog';

export type DbVersion = '5.7' | '8.0' | '8.4' | '9.7';

export interface EngineMeta {
  label: string;
  containerPrefix: string;
  pmm: {
    single: { environment: string; cluster: string };
    replication: { environment: string; cluster: string; replicationSet: string };
    gr: { environment: string; cluster: string; replicationSet: string };
  };
}

export const ENGINES: Record<Engine, EngineMeta> = {
  mysql: {
    label: 'pmm-qa.engine=mysql',
    containerPrefix: 'mysql_pmm',
    pmm: {
      single: { environment: 'mysql-dev', cluster: 'mysql-single-dev-cluster' },
      replication: {
        environment: 'mysql-replication-dev',
        cluster: 'mysql-replication-dev-cluster',
        replicationSet: 'mysql-async-replication',
      },
      gr: {
        environment: 'mysql-gr-dev',
        cluster: 'mysql-gr-dev-cluster',
        replicationSet: 'ps-gr-replication',
      },
    },
  },
  ps: {
    label: 'pmm-qa.engine=ps',
    containerPrefix: 'ps_pmm',
    pmm: {
      single: { environment: 'ps-dev', cluster: 'ps-single-dev-cluster' },
      replication: {
        environment: 'ps-replication-dev',
        cluster: 'ps-replication-dev-cluster',
        replicationSet: 'ps-async-replication',
      },
      gr: {
        environment: 'ps-gr-dev',
        cluster: 'ps-gr-dev-cluster',
        replicationSet: 'ps-gr-replication',
      },
    },
  },
};

export const MINIMUM_NODES: Record<SetupType, number> = { single: 1, replication: 2, gr: 3 };

export function normalizeEngine(value: string | undefined, env: Record<string, string | undefined>): Engine {
  if (value) {
    const engine = value.toLowerCase();
    if (engine === 'mysql' || engine === 'ps') return engine;
    throw new Error('engine must be mysql or ps');
  }
  if (env.PS_VERSION) return 'ps';
  if (env.MS_VERSION) return 'mysql';
  return 'mysql';
}

export function normalizeVersion(engine: Engine, value: string): DbVersion {
  const versions = engine === 'ps' ? ['5.7', '8.0', '8.4'] : ['5.7', '8.0', '8.4', '9.7'];
  if (!versions.includes(value)) {
    throw new Error(`version must be ${versions.join(', ')}`);
  }
  return value as DbVersion;
}

export function defaultVersion(engine: Engine, env: Record<string, string | undefined>): string {
  return (engine === 'ps' ? env.PS_VERSION : env.MS_VERSION) ?? (engine === 'ps' ? '8.0' : '9.7');
}

export function defaultImage(
  engine: Engine,
  version: DbVersion,
  env: Record<string, string | undefined>,
  override?: string,
): string {
  return override ?? (engine === 'ps' ? env.PS_IMAGE : env.MYSQL_IMAGE) ?? `pmm-qa/${engine}:${version}`;
}
