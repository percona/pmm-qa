import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import K8sHelper from '@helpers/k8s.helper';
import PrometheusApi from '@api/prometheus.api';
import { Timeouts } from '@helpers/timeouts';
import { AlertInstance, AlertRule } from '@interfaces/alerting';

const diskRule = {
  folder: 'PMM High Availability',
  group: 'PMM Managed',
  name: 'PMM HA disk space usage is high',
  uid: 'pmm-ha-disk-space-usage',
};
const clientPodSelector = 'app.kubernetes.io/component=pmm-client';
const client = { container: 'pmm-client', dir: '/usr/local/percona/pmm/tmp' };
const fillFile = 'pmm-t2387-fill';
const fillPercent = 90;
const otherNamespace = `pmm-t2388-${Date.now()}`;
const otherVolume = { claim: 'fill', container: 'fill', dir: '/data', pod: 'fill' };
const otherManifest = `
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: ${otherVolume.claim} }
spec: { accessModes: [ReadWriteOnce], resources: { requests: { storage: 1Gi } } }
---
apiVersion: v1
kind: Pod
metadata: { name: ${otherVolume.pod} }
spec:
  containers:
    - name: ${otherVolume.container}
      image: busybox:1.36
      command: [sleep, infinity]
      securityContext:
        allowPrivilegeEscalation: false
        capabilities: { drop: [ALL] }
        seccompProfile: { type: RuntimeDefault }
      volumeMounts: [{ name: data, mountPath: ${otherVolume.dir} }]
  volumes: [{ name: data, persistentVolumeClaim: { claimName: ${otherVolume.claim} } }]
`;

interface VolumeUsage {
  availableMb: number;
  sizeMb: number;
  usedMb: number;
}

const volumeUsage = (k8s: K8sHelper, pod: string, container: string, dir: string): VolumeUsage => {
  const [, sizeMb, usedMb, availableMb] = k8s
    .execInPod(pod, `df -Pm ${dir}`, { container, silent: true })
    .assertSuccess()
    .getStdOutLines()[1]
    .trim()
    .split(/\s+/)
    .map(Number);

  return { availableMb, sizeMb, usedMb };
};

// kubelet's formula, which the rule uses; df's own Capacity column divides by used + available instead.
const percentFull = ({ availableMb, sizeMb }: VolumeUsage): number => 100 * (1 - availableMb / sizeMb);

const fillVolume = (k8s: K8sHelper, pod: string, container: string, dir: string): VolumeUsage => {
  const before = volumeUsage(k8s, pod, container, dir);
  const fillMb = Math.floor((before.sizeMb * fillPercent) / 100 - before.usedMb);

  k8s
    .execInPod(pod, `dd if=/dev/zero of=${dir}/${fillFile} bs=1M count=${fillMb}`, { container })
    .assertSuccess();

  return volumeUsage(k8s, pod, container, dir);
};

const kubeletPercentFull = async (
  prometheusApi: PrometheusApi,
  namespace: string,
  claim: string,
): Promise<number | undefined> => {
  const selector = `job="kubelet",namespace="${namespace}",persistentvolumeclaim="${claim}"`;

  return prometheusApi.instantQueryValue(
    `max(100 * (1 - kubelet_volume_stats_available_bytes{${selector}} / kubelet_volume_stats_capacity_bytes{${selector}}))`,
  );
};

const alertsFor = (rule: AlertRule | undefined, label: string, value: string): AlertInstance[] =>
  (rule?.alerts ?? []).filter((alert) => alert.labels[label] === value);
// A resolved instance stays listed as "Normal" (or "Normal (MissingSeries)") rather than disappearing.
const activeAlertsFor = (rule: AlertRule | undefined, label: string, value: string): AlertInstance[] =>
  alertsFor(rule, label, value).filter(({ state }) => !state.startsWith('Normal'));

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2386 - Verify PMM HA creates the built-in disk space usage alert rule @pmm-ha',
  async ({ api }) => {
    const rule = await pmmTest.step(`Verify the rule "${diskRule.uid}" is provisioned`, async () =>
      api.alertingApi.getProvisionedRule(diskRule.uid),
    );

    await pmmTest.step(
      `Verify it is "${diskRule.name}" in "${diskRule.folder}" / "${diskRule.group}"`,
      async () => {
        const folder = (await api.alertingApi.listFolders()).find(({ uid }) => uid === rule.folderUID);

        expect(rule.title).toEqual(diskRule.name);
        expect(folder?.title).toEqual(diskRule.folder);
        expect(rule.ruleGroup).toEqual(diskRule.group);
      },
    );

    await pmmTest.step(
      'Verify it is read-only and fires above 80% for 10m with severity warning',
      async () => {
        expect(rule.provenance, 'A provisioned rule is read-only in the UI').toBeTruthy();
        expect(rule.data.find(({ refId }) => refId === 'C')?.model.expression).toEqual('$A > 80');
        expect(rule.for).toEqual('10m');
        expect(rule.labels?.severity).toEqual('warning');
      },
    );
  },
);

pmmTest.describe('PMM HA disk space alert on filled volumes', () => {
  pmmTest.afterEach(async ({ k8sHelper }) => {
    for (const pod of k8sHelper.getPodNames(clientPodSelector)) {
      k8sHelper.execInPod(pod, `rm -f ${client.dir}/${fillFile}`, {
        container: client.container,
        silent: true,
      });
    }

    k8sHelper.exec(`delete namespace ${otherNamespace} --ignore-not-found --wait=false`);
  });

  pmmTest(
    'PMM-T2387 + PMM-T2388 - Verify the disk space alert fires when a PMM volume is over 80% full and clears when space is freed, Verify volumes outside the PMM namespace do not fire the disk space alert @pmm-ha',
    async ({ api, k8sHelper }) => {
      pmmTest.setTimeout(Timeouts.SIXTY_MINUTES);

      const namespace = k8sHelper.namespace;
      const clientPod = k8sHelper.getPodNames(clientPodSelector).sort()[0];
      const clientClaim = `pmm-agent-${clientPod}`;
      const otherK8s = new K8sHelper(otherNamespace);

      await pmmTest.step(`Verify "${clientClaim}" is below 80% and has no disk space alert`, async () => {
        expect(percentFull(volumeUsage(k8sHelper, clientPod, client.container, client.dir))).toBeLessThan(80);
        expect(
          activeAlertsFor(await api.alertingApi.getRule(diskRule.name), 'persistentvolumeclaim', clientClaim),
        ).toEqual([]);
      });

      await pmmTest.step(`Fill a volume in namespace "${otherNamespace}" to ${fillPercent}%`, async () => {
        const manifest = join(tmpdir(), `${otherNamespace}.yaml`);

        writeFileSync(manifest, otherManifest);
        k8sHelper.exec(`create namespace ${otherNamespace}`).assertSuccess();
        otherK8s.exec(`apply --filename=${manifest}`).assertSuccess();
        otherK8s.exec(`wait --for=condition=Ready pod/${otherVolume.pod} --timeout=5m`).assertSuccess();

        expect(
          percentFull(fillVolume(otherK8s, otherVolume.pod, otherVolume.container, otherVolume.dir)),
        ).toBeGreaterThan(80);
      });

      const clientUsage = await pmmTest.step(`Fill "${clientClaim}" to ${fillPercent}%`, async () => {
        const usage = fillVolume(k8sHelper, clientPod, client.container, client.dir);

        expect(percentFull(usage)).toBeGreaterThan(80);

        return usage;
      });

      await pmmTest.step('Verify PMM sees both volumes over 80%', async () => {
        await expect(async () => {
          expect(await kubeletPercentFull(api.prometheusApi, namespace, clientClaim)).toBeGreaterThan(80);
          expect(
            await kubeletPercentFull(api.prometheusApi, otherNamespace, otherVolume.claim),
          ).toBeGreaterThan(80);
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });

      const alert = await pmmTest.step(`Verify "${diskRule.name}" fires for "${clientClaim}"`, async () => {
        let firing: AlertInstance | undefined;

        // 10m pending period, plus a kubelet stats refresh and a rule evaluation.
        await expect(async () => {
          const alerts = alertsFor(
            await api.alertingApi.getRule(diskRule.name),
            'persistentvolumeclaim',
            clientClaim,
          );

          expect(alerts.map(({ state }) => state)).toEqual(['Alerting']);
          firing = alerts[0];
        }).toPass({ intervals: [Timeouts.THIRTY_SECONDS], timeout: Timeouts.FIFTEEN_MINUTES });

        return firing as AlertInstance;
      });

      await pmmTest.step('Verify the alert names the volume, the namespace and how full it is', async () => {
        const summary = alert.annotations?.summary ?? '';
        const reported = Number(/is ([\d.]+)% full/.exec(summary)?.[1]);

        expect(alert.labels.namespace).toEqual(namespace);
        expect(summary).toContain(`Volume '${clientClaim}' in PMM HA namespace '${namespace}'`);
        expect(
          Math.abs(reported - percentFull(clientUsage)),
          `"${summary}" against df's ${percentFull(clientUsage).toFixed(1)}%`,
        ).toBeLessThanOrEqual(1);
      });

      await pmmTest.step(`Verify no disk space alert names namespace "${otherNamespace}"`, async () => {
        expect(alertsFor(await api.alertingApi.getRule(diskRule.name), 'namespace', otherNamespace)).toEqual(
          [],
        );
      });

      await pmmTest.step(`Free "${clientClaim}" and verify its alert clears`, async () => {
        k8sHelper
          .execInPod(clientPod, `rm -f ${client.dir}/${fillFile}`, { container: client.container })
          .assertSuccess();

        await expect(async () => {
          expect(
            activeAlertsFor(
              await api.alertingApi.getRule(diskRule.name),
              'persistentvolumeclaim',
              clientClaim,
            ),
          ).toEqual([]);
        }).toPass({ intervals: [Timeouts.THIRTY_SECONDS], timeout: Timeouts.TEN_MINUTES });
      });
    },
  );
});
