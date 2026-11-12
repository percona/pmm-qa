import K8sHelper from '@helpers/k8s.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const refreshAnnotation = 'argocd.argoproj.io/refresh';

export interface IgnoreDifference {
  group?: string;
  kind: string;
  managedFieldsManagers?: string[];
  name?: string;
}

interface ArgoCdApplication {
  metadata: { annotations?: Record<string, string> };
  spec?: {
    ignoreDifferences?: IgnoreDifference[];
    syncPolicy?: { automated?: { prune?: boolean; selfHeal?: boolean } };
  };
  status?: {
    conditions?: { message?: string; type: string }[];
    health?: { status?: string };
    operationState?: {
      finishedAt?: string;
      message?: string;
      phase?: string;
      syncResult?: { resources?: { kind: string; message?: string; name: string }[] };
    };
    sync?: { status?: string };
  };
}

/** Argo CD `Application`s, read and changed through kubectl rather than the argocd CLI. */
export default class ArgoCdHelper {
  constructor(private k8sHelper: K8sHelper = new K8sHelper('argocd')) {}

  /** The Application names equal the Helm release names, so release-named objects derive from `pmm`. */
  apps = (): { deps: string; pmm: string } => {
    const value = process.env.PMM_HA_ARGOCD_APPS || 'pmm-operators,pmm-ha';
    const [deps, pmm, ...rest] = value.split(',').map((name) => name.trim());

    if (!deps || !pmm || rest.length) {
      throw new Error(`PMM_HA_ARGOCD_APPS must be "<dependencies app>,<pmm app>", got "${value}"`);
    }

    return { deps, pmm };
  };

  /** `undefined` when the Application syncs only by hand. */
  automatedSyncPolicy = (app: string): { prune?: boolean; selfHeal?: boolean } | undefined =>
    this.application(app).spec?.syncPolicy?.automated;

  /** Asks Argo CD to re-render each Application from source, then gives it settleMs to do so. */
  hardRefresh = async (apps: string[], settleMs: number): Promise<void> => {
    for (const app of apps) {
      this.k8sHelper
        .exec(`annotate applications.argoproj.io ${app} ${refreshAnnotation}=hard --overwrite`)
        .assertSuccess();
    }

    await new Promise((resolve) => setTimeout(resolve, settleMs));
  };

  healthStatus = (app: string): string => this.application(app).status?.health?.status ?? '';

  ignoreDifferences = (app: string): IgnoreDifference[] =>
    this.application(app).spec?.ignoreDifferences ?? [];

  lastOperationFinishedAt = (app: string): string =>
    this.application(app).status?.operationState?.finishedAt ?? '';

  /** Argo CD drops the annotation once it has acted on it. */
  refreshPending = (app: string): boolean =>
    refreshAnnotation in (this.application(app).metadata.annotations ?? {});

  setSelfHeal = (app: string, on: boolean): void => {
    const patch = JSON.stringify({ spec: { syncPolicy: { automated: { selfHeal: on } } } });

    this.k8sHelper
      .exec(`patch applications.argoproj.io ${app} --type=merge --patch='${patch}'`)
      .assertSuccess();
  };

  syncResultMessage = (app: string, kind: string, name: string): string => {
    const resources = this.application(app).status?.operationState?.syncResult?.resources ?? [];
    const resource = resources.find((entry) => entry.kind === kind && entry.name === name);

    if (!resource) {
      throw new Error(
        `${kind}/${name} is not in the last sync result of Application "${app}", which lists: ${
          resources.map((entry) => `${entry.kind}/${entry.name}`).join(', ') || 'nothing'
        }`,
      );
    }

    return resource.message ?? '';
  };

  syncStatus = (app: string): string => this.application(app).status?.sync?.status ?? '';

  waitForSyncedHealthy = async (app: string, timeout: Timeouts): Promise<void> => {
    await expect(async () => {
      const status = this.application(app).status;
      const conditions =
        status?.conditions?.map((condition) => `${condition.type}: ${condition.message ?? ''}`).join('; ') ||
        '(none)';
      const operation = status?.operationState;

      expect(
        { health: status?.health?.status, sync: status?.sync?.status },
        [
          `Argo CD Application "${app}" must be Synced and Healthy.`,
          `sync: ${status?.sync?.status ?? '(none)'}, health: ${status?.health?.status ?? '(none)'}`,
          `conditions: ${conditions}`,
          `last operation (${operation?.phase ?? 'none'}): ${operation?.message ?? '(no message)'}`,
        ].join('\n'),
      ).toEqual({ health: 'Healthy', sync: 'Synced' });
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout });
  };

  private application = (app: string): ArgoCdApplication =>
    JSON.parse(
      this.k8sHelper.execSilent(`get applications.argoproj.io ${app} --output=json`).assertSuccess().stdout,
    ) as ArgoCdApplication;
}
