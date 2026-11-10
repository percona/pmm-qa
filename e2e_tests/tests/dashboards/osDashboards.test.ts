import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2039 - Open the Node Summary Dashboard and verify Metrics are present and graphs are displayed @nightly  @dashboards @gssapi-nightly',
  async ({ api, dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.os.nodeSummary.url, {
        from: 'now-1h',
        nodeName: await api.haApi.getPmmServerNodeName(),
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.os.nodeSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.os.nodeSummary.noDataMetrics);
  },
);

pmmTest(
  'PMM-T2299 - Open the Nodes Compare Dashboard and verify Metrics are present and graphs are displayed @nightly  @dashboards @gssapi-nightly',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.os.nodesCompare.url, {
        from: 'now-1h',
        refresh: '1m',
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.os.nodesCompare.metrics, undefined, true);
    await dashboard.verifyAllPanelsHaveData(dashboard.os.nodesCompare.noDataMetrics);
  },
);

pmmTest(
  'PMM-T418 + PMM-T419 - Verify the pt-summary on Node Summary dashboard @nightly  @dashboards @gssapi-nightly',
  async ({ api, dashboard, page }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- System Summary asks for the dashboard's default node_id, pmm-server, which HA does not have (PMM-9884); followers' agents can't run it either (PMM-15684).
    pmmTest.skip(
      await api.haApi.isEnabled(),
      'System Summary requests node pmm-server, see PMM-9884 and PMM-15684',
    );

    await page.goto(dashboard.os.nodeSummary.url);
    await dashboard.loadAllPanels();
    await expect(dashboard.elements.summaryPanelText).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
  },
);

pmmTest(
  'PMM-T1695 - Verify that user is able to filter OS / Node Compare dashboard by Node Name @nightly  @dashboards @gssapi-nightly',
  async ({ api, dashboard, page, urlHelper }) => {
    const mergedNodes = (await api.inventoryApi.getAllNodes()).filter(
      (node) => node.node_type === 'generic' || node.node_type === 'container',
    );
    const node1 = mergedNodes[0].node_name;
    const node2 = mergedNodes[1].node_name;

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.os.nodesCompare.url, {
        from: 'now-5m',
        nodeName: node1,
        to: 'now',
      }),
    );
    await dashboard.waitForDashboardToLoad();
    await expect(dashboard.elements.panelHeaders).not.toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(dashboard.elements.loadingBar).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });

    const initialNumOfPanels = await dashboard.elements.panelHeaders.filter({ visible: true }).count();

    await pmmTest.step(`Verify only ${node1} is compared`, async () => {
      await dashboard.elements.panelHeaders.first().click();
      await expect(dashboard.builders.panelByExactName(`${node2} - System Uptime`)).toBeHidden();
      await expect(dashboard.builders.panelByExactName(`${node1} - System Uptime`)).toBeVisible();
    });

    await dashboard.selectVariableValue('Node Name', node2);

    await expect
      .poll(() => dashboard.elements.panelHeaders.filter({ visible: true }).count(), {
        message: 'Number of panels should increase after adding another node for comparison',
        timeout: Timeouts.THIRTY_SECONDS,
      })
      .toBeGreaterThan(initialNumOfPanels);
    await expect(dashboard.builders.panelByExactName(`${node1} - System Uptime`)).toBeVisible();
    await expect(dashboard.builders.panelByExactName(`${node2} - System Uptime`)).toBeVisible();
  },
);

pmmTest(
  'Verify the Netstat: TCP panel shows new connections, resets and retransmits per second that rise during a burst and fall back afterwards @dashboards @docker-configuration',
  async ({ api, cliHelper, dashboard, page, urlHelper }) => {
    const { networkDetails } = dashboard.os;
    const { netstatTcp } = networkDetails;
    const [activeOpens, passiveOpens] = netstatTcp.connectionOpens;
    const nodeName = await api.haApi.getPmmServerNodeName();

    const openNetworkDetails = async (from: number | string, to: number | string = 'now') => {
      await page.goto(
        urlHelper.buildUrlWithParameters(networkDetails.url, {
          from: String(from),
          nodeName,
          to: String(to),
        }),
      );
      await dashboard.loadAllPanels();
    };

    const readRate = async (seriesName: string, column: 'Max' | 'Min') => {
      const value = dashboard.builders.legendValue(netstatTcp.name, seriesName, column);

      await expect(value, `${seriesName} ${column} is shown in ops/s`).toHaveText(netstatTcp.rateValue);

      return parseFloat(await value.innerText());
    };

    await pmmTest.step(
      'Open Network Details for the last 30 minutes and verify the Netstat: TCP legend',
      async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(networkDetails.url, { from: 'now-30m', nodeName, to: 'now' }),
        );
        await dashboard.verifyAllPanelsHaveData(networkDetails.noDataMetrics);

        for (const series of netstatTcp.series) {
          await expect(dashboard.builders.legendSeries(netstatTcp.name, series)).toBeVisible();
        }
      },
    );

    const burstStart = Date.now();
    const burst = cliHelper.execute(netstatTcp.localBurst.command).assertSuccess();
    const burstEnd = Date.now();
    const burstRate = (netstatTcp.localBurst.connections * 1_000) / (burstEnd - burstStart);

    expect(burst.getStdOutLines().map((line) => line.trim())).toEqual([netstatTcp.localBurst.output]);
    // eslint-disable-next-line playwright/no-wait-for-timeout -- the case waits for the rates to settle; polling the dashboard would open connections of its own
    await page.waitForTimeout(Timeouts.TWO_MINUTES);

    await pmmTest.step(
      'Verify activeOpens and passiveOpens fall back to a few ops/s after the burst',
      async () => {
        await openNetworkDetails(
          burstEnd + Timeouts.THIRTY_SECONDS,
          burstEnd + Timeouts.ONE_MINUTE + Timeouts.THIRTY_SECONDS,
        );

        for (const series of netstatTcp.connectionOpens) {
          expect(await readRate(series, 'Max'), `${series} after the burst`).toBeLessThan(
            netstatTcp.tensOfOpsFrom,
          );
        }
      },
    );

    await pmmTest.step(
      'Verify activeOpens and passiveOpens overlap at the burst rate during the burst',
      async () => {
        await openNetworkDetails(burstStart + Timeouts.TEN_SECONDS, burstEnd - Timeouts.FIVE_SECONDS);

        const active = await readRate(activeOpens, 'Max');
        const passive = await readRate(passiveOpens, 'Max');

        for (const rate of [active, passive]) {
          expect(rate, `rate during a burst of ${burstRate.toFixed(1)} connections/s`).toBeGreaterThanOrEqual(
            burstRate / 2,
          );
          expect(rate).toBeLessThan(netstatTcp.tensOfOpsUpTo);
        }

        expect(
          Math.abs(active - passive),
          'loopback activeOpens and passiveOpens overlap',
        ).toBeLessThanOrEqual(Math.max(active, passive) / 5);
      },
    );

    await pmmTest.step(
      'Verify the last 30 minutes show per-second rates, not since-boot totals',
      async () => {
        await openNetworkDetails('now-30m');

        const max = await readRate(activeOpens, 'Max');

        expect(await readRate(activeOpens, 'Min')).toBeLessThan(netstatTcp.tensOfOpsFrom);
        expect(max).toBeGreaterThanOrEqual(netstatTcp.tensOfOpsFrom);
        expect(max).toBeLessThan(netstatTcp.tensOfOpsUpTo);

        for (const series of netstatTcp.connectionProblems) {
          expect(await readRate(series, 'Max'), `${series} Max`).toBeLessThan(netstatTcp.maxProblemRate);
        }
      },
    );
  },
);

pmmTest(
  'Verify established connections have their own Connections axis and the Netstat: TCP panel looks the same at Last 1 hour and Last 24 hours @nightly @dashboards',
  async ({ api, dashboard, page, urlHelper }) => {
    const { networkDetails } = dashboard.os;
    const { netstatTcp } = networkDetails;
    const nodeName = await api.haApi.getPmmServerNodeName();

    for (const from of ['now-1h', 'now-24h']) {
      await pmmTest.step(`Verify the Netstat: TCP axes and legend from ${from}`, async () => {
        await page.goto(urlHelper.buildUrlWithParameters(networkDetails.url, { from, nodeName, to: 'now' }));
        await dashboard.verifyAllPanelsHaveData(networkDetails.noDataMetrics);
        await expect(dashboard.builders.legendSeriesIcons(netstatTcp.name)).toHaveCount(
          netstatTcp.series.length,
        );
        await expect(dashboard.builders.legendSeries(netstatTcp.name, netstatTcp.established)).toHaveText(
          netstatTcp.establishedLegend,
        );
        await expect(
          dashboard.builders.legendValue(netstatTcp.name, netstatTcp.established, 'Mean'),
        ).not.toHaveText(/ops\/s/);

        for (const series of [...netstatTcp.connectionOpens, ...netstatTcp.connectionProblems]) {
          await expect(dashboard.builders.legendSeries(netstatTcp.name, series)).toHaveText(series);
          await expect(dashboard.builders.legendValue(netstatTcp.name, series, 'Mean')).toHaveText(
            netstatTcp.rateValue,
          );
        }

        await expect
          .poll(() => dashboard.getPanelFieldConfig(netstatTcp.name), {
            message: `${netstatTcp.name} keeps the rates on the left axis and established on the right`,
          })
          .toMatchObject({
            defaults: { unit: netstatTcp.rateUnit },
            overrides: [
              {
                ...netstatTcp.rightAxisOverride,
                properties: expect.arrayContaining(netstatTcp.rightAxisOverride.properties),
              },
            ],
          });
      });
    }
  },
);
