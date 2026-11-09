import K8sHelper from '@helpers/k8s.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const reconcileAnnotation = 'reconcile.fluxcd.io/requestedAt';
const helmRelease = 'helmreleases.helm.toolkit.fluxcd.io';
const sourceResources = {
  GitRepository: 'gitrepositories.source.toolkit.fluxcd.io',
  HelmRepository: 'helmrepositories.source.toolkit.fluxcd.io',
};

export type FluxSourceKind = keyof typeof sourceResources;

export interface FluxCondition {
  message?: string;
  reason?: string;
  status: string;
  type: string;
}

export interface DriftIgnore {
  paths: string[];
  target?: { kind?: string; name?: string };
}

interface FluxObject {
  metadata?: { annotations?: Record<string, string> };
  spec?: {
    driftDetection?: { ignore?: DriftIgnore[]; mode?: string };
    install?: { strategy?: { name?: string } };
    interval?: string;
    timeout?: string;
    upgrade?: { crds?: string; strategy?: { name?: string } };
  };
  status?: {
    conditions?: FluxCondition[];
    history?: { version: number }[];
    lastHandledReconcileAt?: string;
  };
}

/** Flux `HelmRelease`s and their sources, read and changed through kubectl rather than the flux CLI. */
export default class FluxHelper {
  constructor(private k8sHelper: K8sHelper = new K8sHelper('pmm')) {}

  driftDetection = (name: string): { ignore?: DriftIgnore[]; mode?: string } =>
    this.release(name).spec?.driftDetection ?? {};

  driftEvents = (name: string): string[] => {
    const selector = `involvedObject.kind=HelmRelease,involvedObject.name=${name}`;
    const events = JSON.parse(
      this.k8sHelper.execSilent(`get events --field-selector=${selector} --output=json`).assertSuccess()
        .stdout,
    ) as { items?: { message?: string; reason?: string }[] };

    return (events.items ?? [])
      .filter((event) => /drift/i.test(event.reason ?? '') || /drift/i.test(event.message ?? ''))
      .map((event) => event.message ?? '');
  };

  ready = (name: string): { message: string; reason: string; status: string } => {
    const condition = this.release(name).status?.conditions?.find((entry) => entry.type === 'Ready');

    return {
      message: condition?.message ?? '',
      reason: condition?.reason ?? '',
      status: condition?.status ?? '',
    };
  };

  reconcileHandled = (name: string, requestedAt: string): boolean =>
    this.release(name).status?.lastHandledReconcileAt === requestedAt;

  releaseRevision = (name: string): number => {
    const version = this.release(name).status?.history?.[0]?.version;

    if (version === undefined) {
      throw new Error(`HelmRelease "${name}" has no Helm release history yet`);
    }

    return version;
  };

  /** The HelmRelease names equal the Helm release names, so release-named objects derive from `pmm`. */
  releases = (): { deps: string; pmm: string } => {
    const value = process.env.PMM_HA_FLUX_RELEASES || 'pmm-operators,pmm-ha';
    const [deps, pmm, ...rest] = value.split(',').map((name) => name.trim());

    if (!deps || !pmm || rest.length) {
      throw new Error(`PMM_HA_FLUX_RELEASES must be "<dependencies release>,<pmm release>", got "${value}"`);
    }

    return { deps, pmm };
  };

  requestReconcile = (name: string): string => {
    const requestedAt = new Date().toISOString();

    this.k8sHelper
      .exec(`annotate ${helmRelease} ${name} ${reconcileAnnotation}=${requestedAt} --overwrite`)
      .assertSuccess();

    return requestedAt;
  };

  setSuspend = (name: string, on: boolean): void => {
    this.patch(name, { spec: { suspend: on } });
  };

  /** A dotted `path` such as `pmmEnv.KEY` merges into `spec.values`; `null` removes the key. */
  setValue = (name: string, path: string, value: string | null): void => {
    const nested = path.split('.').reduceRight<unknown>((inner, key) => ({ [key]: inner }), value);

    this.patch(name, { spec: { values: nested } });
  };

  sourceReady = (kind: FluxSourceKind, name: string): boolean =>
    this.object(sourceResources[kind], name).status?.conditions?.find((entry) => entry.type === 'Ready')
      ?.status === 'True';

  /** Parsed from `PMM_HA_FLUX_SOURCES` as `Kind/name,...`. */
  sources = (): { kind: FluxSourceKind; name: string }[] => {
    const value = process.env.PMM_HA_FLUX_SOURCES || '';

    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [kind, name, ...rest] = entry.split('/');

        if (!(kind in sourceResources) || !name || rest.length) {
          throw new Error(
            `PMM_HA_FLUX_SOURCES entries must be "GitRepository/<name>" or "HelmRepository/<name>", got "${entry}" in "${value}"`,
          );
        }

        return { kind: kind as FluxSourceKind, name };
      });
  };

  strategies = (
    name: string,
  ): { crds?: string; install?: string; interval?: string; timeout?: string; upgrade?: string } => {
    const spec = this.release(name).spec;

    return {
      crds: spec?.upgrade?.crds,
      install: spec?.install?.strategy?.name,
      interval: spec?.interval,
      timeout: spec?.timeout,
      upgrade: spec?.upgrade?.strategy?.name,
    };
  };

  waitForReady = async (name: string, timeout: Timeouts): Promise<void> => {
    await expect(async () => {
      const conditions = this.release(name).status?.conditions;

      expect(
        conditions?.find((entry) => entry.type === 'Ready')?.status,
        `Flux HelmRelease "${name}" must be Ready.\n${this.describe(conditions)}`,
      ).toBe('True');
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout });
  };

  private describe = (conditions: FluxCondition[] | undefined): string =>
    `conditions: ${
      conditions
        ?.map(
          (condition) =>
            `${condition.type}=${condition.status} (${condition.reason ?? ''}): ${condition.message ?? ''}`,
        )
        .join('; ') || '(none)'
    }`;

  private object = (resource: string, name: string): FluxObject =>
    JSON.parse(
      this.k8sHelper.execSilent(`get ${resource} ${name} --output=json`).assertSuccess().stdout,
    ) as FluxObject;

  private patch = (name: string, patch: object): void => {
    this.k8sHelper
      .exec(`patch ${helmRelease} ${name} --type=merge --patch='${JSON.stringify(patch)}'`)
      .assertSuccess();
  };

  private release = (name: string): FluxObject => this.object(helmRelease, name);
}
