import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { HaNodeRole } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';
import { defaultReplicas } from '@helpers/haCluster.helper';
import { pmmUrl } from '../../playwright.config';

const publicHost = new URL(pmmUrl).hostname;

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2138 - Verify PMM UI is accessible if leader pod goes down @pmm-ha',
  async ({ api, dashboard, haClusterHelper, k8sHelper, page, request }) => {
    // The case's precondition: the public URL is the cluster's shared entry point in
    // front of HAProxy, not one pod. Without it, "the UI stayed up" could be measured
    // against a single pod and pass while proving nothing.
    await pmmTest.step(`Verify "${publicHost}" fronts a service in the cluster`, async () => {
      const services = k8sHelper.getServices();
      // ROSA publishes HAProxy through an OpenShift Route rather than a cloud load
      // balancer, so on that cluster the public host is the route's and no Service
      // ever carries it.
      const frontDoors = [
        ...services
          .filter(
            (service) =>
              service.type === 'LoadBalancer' && service.loadBalancerAddresses.includes(publicHost),
          )
          .map((service) => service.name),
        ...k8sHelper
          .getRoutes()
          .filter((route) => route.host === publicHost)
          .map((route) => route.serviceName),
      ];

      expect(
        frontDoors.filter((target) => services.some((service) => service.name === target)),
        `No LoadBalancer service and no OpenShift route in namespace "${k8sHelper.namespace}" answers ` +
          `for the public URL in front of a service`,
      ).not.toHaveLength(0);
    });

    await pmmTest.step('Log in to the PMM UI on the public URL', async () => {
      await page.goto(dashboard.home.url);

      await expect(dashboard.home.elements.homeDashboardLocator).toBeVisible({
        timeout: Timeouts.ONE_MINUTE,
      });
    });

    await pmmTest.step('Verify the leader the HA API reports is the pod that holds leadership', async () => {
      const nodes = await api.haApi.getNodes();
      const leaders = nodes.filter((node) => node.role === HaNodeRole.leader);

      expect(nodes).toHaveLength(defaultReplicas);
      expect(nodes.map((node) => node.status)).toEqual(Array(defaultReplicas).fill('alive'));
      expect(leaders.map((node) => node.node_name)).toEqual([haClusterHelper.leaderFromPods()]);
    });

    const { failures, longestOutage, newLeader, probes } = await pmmTest.step(
      'Restart the leader pod while polling the public URL',
      async () => await haClusterHelper.failoverLeaderWhileProbing(api.haApi, request, dashboard.home.url),
    );

    await pmmTest.step(
      `Verify the PMM UI never goes down and stays active while "${newLeader}" takes over, ` +
        `across ${probes} requests`,
      async () => {
        // The case is "the UI should always be up", so the budget is zero: every
        // request through HAProxy is served, or this is a real outage.
        expect(
          failures,
          `The public URL must serve every request through the failover, but ${failures} of ${probes} ` +
            `failed - the longest unbroken outage was ${longestOutage / Timeouts.ONE_SECOND}s`,
        ).toEqual(0);

        await page.goto(dashboard.home.url);

        await expect(dashboard.home.elements.homeDashboardLocator).toBeVisible({
          timeout: Timeouts.ONE_MINUTE,
        });
      },
    );
  },
);
