import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import Api from '@api/api';
import CliHelper from '@helpers/cli.helper';
import DockerHelper from '@helpers/docker.helper';
import { ServiceType } from '@interfaces/inventory';

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

// Runs on the host of `pmm-framework --database pxc --database psmdb,SETUP_TYPE=psa --database valkey`:
// the tests change the PXC and Valkey containers and the host's kernel settings.
// rs103 is the arbiter, and pxc_node__3 is PXC node 3 in the pxc_proxysql_pmm_<version> container.
const frameworkNode = async (api: Api, dockerHelper: DockerHelper, serviceRegex: string) => {
  const service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);

  if (!service) throw new Error(`No service matches ${serviceRegex}`);

  const container = await dockerHelper.getServiceContainer(api, service);

  return {
    container,
    hostname: dockerHelper.getContainerHostname(container),
    nodeName: service.node_name,
    service,
  };
};

// pt-summary is a perl script, and the psmdb and valkey images come without perl.
const installPerl = (cliHelper: CliHelper, container: string) =>
  cliHelper.execute(`docker exec ${container} dnf install -y -q perl-interpreter`).assertSuccess();
const sortedRows = (rows: Record<string, string>[]) =>
  [...rows].sort((a, b) => a.Service.localeCompare(b.Service));

pmmTest(
  'PMM-15901 - System Summary shows the selected node @node-summary',
  async ({ api, cliHelper, dashboard, dockerHelper, page, urlHelper }) => {
    const { nodeSummary } = dashboard.os;
    const pxc = await frameworkNode(api, dockerHelper, '^pxc_node__1_');
    const arbiter = await frameworkNode(api, dockerHelper, '^rs103_');
    const valkey = await frameworkNode(api, dockerHelper, '^valkey-primary-1-svc$');
    const pmmServerNodeName = await api.haApi.getPmmServerNodeName();

    installPerl(cliHelper, arbiter.container);
    installPerl(cliHelper, valkey.container);

    await pmmTest.step('Open Node Summary from a link that names only the PXC node', async () => {
      await page.goto(urlHelper.buildUrlWithParameters(nodeSummary.url, { nodeName: pxc.nodeName }));
      await expect(dashboard.elements.summaryFingerprint).toContainText(
        nodeSummary.systemSummaryHostname(pxc.hostname),
        { timeout: Timeouts.TWO_MINUTES },
      );
    });

    await pmmTest.step('Select the arbiter node', async () => {
      await dashboard.selectVariableValue('Node Name', arbiter.nodeName);
      await expect(dashboard.elements.summaryFingerprint).toContainText(
        nodeSummary.systemSummaryHostname(arbiter.hostname),
        { timeout: Timeouts.TWO_MINUTES },
      );
    });

    await pmmTest.step('Select pmm-server', async () => {
      await dashboard.selectVariableValue('Node Name', pmmServerNodeName);
      await expect(dashboard.elements.summaryFingerprint).toContainText(
        nodeSummary.systemSummaryHostname(dockerHelper.getContainerHostname('pmm-server')),
        { timeout: Timeouts.TWO_MINUTES },
      );
    });

    await pmmTest.step('Load Node Summary from a link that names the Valkey node', async () => {
      await page.goto(urlHelper.buildUrlWithParameters(nodeSummary.url, { nodeName: valkey.nodeName }));
      await expect(dashboard.elements.summaryFingerprint).toContainText(
        nodeSummary.systemSummaryHostname(valkey.hostname),
        { timeout: Timeouts.TWO_MINUTES },
      );
    });
  },
);

pmmTest.describe('Node Summary with a stopped PXC node', () => {
  const pxcNode = 3;
  // pmm-framework's load. It ends when ProxySQL moves the writer, which a stopped and restarted node can do.
  const sysbench =
    'sysbench --mysql-db=sbtest --mysql-user=proxysql_user --mysql-password=passw0rd --mysql-host=127.0.0.1 --mysql-port=6033 --db-driver=mysql --threads=1 --tables=10 --table-size=1000 /usr/share/sysbench';
  const writerPort = (cliHelper: CliHelper, container: string) =>
    cliHelper
      .execSilent(
        `docker exec ${container} mysql -uadmin -padmin -h127.0.0.1 -P6032 -N -e "SELECT port FROM runtime_mysql_servers WHERE status = 'ONLINE' AND hostgroup_id = (SELECT writer_hostgroup FROM runtime_mysql_galera_hostgroups)"`,
      )
      .stdout.trim();
  // A second mysqld on the same datadir crashes the running one, so start it only when none runs.
  // The path goes through $f so that pgrep does not match this shell's own command line.
  const startNode = (container: string) =>
    `docker exec --detach ${container} sh -c 'f=/var/lib/pxc/node${pxcNode}.cnf; pgrep -f "defaults-file=[/]var/lib/pxc/node${pxcNode}[.]cnf" || exec mysqld --defaults-file=$f'`;
  let pxcContainer = '';
  let writer = '';

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.execute(startNode(pxcContainer)).assertSuccess();
    await expect
      .poll(() => writerPort(cliHelper, pxcContainer), {
        message: `ProxySQL should write to port ${writer} again`,
        timeout: Timeouts.FIVE_MINUTES,
      })
      .toEqual(writer);
    cliHelper.execute(`docker exec ${pxcContainer} pkill -f "[o]ltp_read_"`);

    for (const [lua, log] of [
      ['oltp_read_only.lua --time=12000', 'read-only'],
      ['oltp_read_write.lua --time=0', 'read-write'],
    ]) {
      cliHelper
        .execute(
          `docker exec --detach ${pxcContainer} sh -c "${sysbench}/${lua} run > /tmp/workload-${log}.log 2>&1"`,
        )
        .assertSuccess();
    }
  });

  pmmTest(
    'PMM-15901 - Services panels list every service with health @node-summary',
    async ({ api, cliHelper, dashboard, dockerHelper, page, urlHelper }) => {
      const { nodeSummary } = dashboard.os;
      const { panelName: servicesPanel, statusColors } = nodeSummary.services;
      const typesPanel = nodeSummary.serviceTypes.panelName;
      const pxc = await frameworkNode(api, dockerHelper, `^pxc_node__${pxcNode}_`);
      const nodes = [
        pxc,
        await frameworkNode(api, dockerHelper, '^rs103_'),
        await frameworkNode(api, dockerHelper, '^valkey-primary-1-svc$'),
      ];
      const { services } = await api.inventoryApi.getServices();
      const serviceRows = (nodeId: string, status: string) =>
        sortedRows(
          services
            .filter(({ node_id }) => node_id === nodeId)
            .map(({ service_name, service_type }) => ({
              Service: service_name,
              Status: status,
              Type: nodeSummary.serviceTypes.names[service_type],
            })),
        );

      const typeRows = (nodeId: string) => {
        const amounts = new Map<string, number>();

        for (const { Type } of serviceRows(nodeId, '')) amounts.set(Type, (amounts.get(Type) ?? 0) + 1);

        return [...amounts]
          .map(([Type, amount]) => ({ Amount: String(amount), Type }))
          .sort((a, b) => a.Type.localeCompare(b.Type));
      };

      const sortedTypes = async () =>
        [...(await dashboard.getTableRowsAfterRefresh(typesPanel))].sort((a, b) =>
          a.Type.localeCompare(b.Type),
        );
      // toPass, not poll: a refresh that is still loading throws, and that has to be retried too.
      const verifyRows = async (read: () => Promise<unknown>, expected: unknown, timeout: Timeouts) =>
        expect(async () => expect(await read()).toEqual(expected)).toPass({
          intervals: [Timeouts.TEN_SECONDS],
          timeout,
        });
      const sortedServices = async () => sortedRows(await dashboard.getTableRowsAfterRefresh(servicesPanel));

      pxcContainer = pxc.container;
      writer = writerPort(cliHelper, pxc.container);
      expect(writer).toMatch(/^\d+$/);
      expect(typeRows(pxc.service.node_id)).toEqual([
        { Amount: '3', Type: 'MySQL' },
        { Amount: '1', Type: 'ProxySQL' },
      ]);

      await page.goto(
        urlHelper.buildUrlWithParameters(nodeSummary.url, {
          from: 'now-15m',
          nodeName: pxc.nodeName,
          to: 'now',
        }),
      );

      for (const node of nodes) {
        const expectedRows = serviceRows(node.service.node_id, nodeSummary.services.up);

        await pmmTest.step(`Verify every service of ${node.nodeName} is UP in green`, async () => {
          await dashboard.selectVariableValue('Node Name', node.nodeName);
          await verifyRows(sortedTypes, typeRows(node.service.node_id), Timeouts.TWO_MINUTES);
          await verifyRows(sortedServices, expectedRows, Timeouts.TWO_MINUTES);

          for (let row = 0; row < expectedRows.length; row++) {
            await expect(dashboard.builders.tableCell(servicesPanel, row, 2)).toHaveCSS(
              'color',
              statusColors.UP,
            );
          }
        });
      }

      const downService = pxc.service.service_name;
      const upRows = serviceRows(pxc.service.node_id, nodeSummary.services.up).filter(
        ({ Service }) => Service !== downService,
      );

      await pmmTest.step(`Stop PXC node ${pxcNode} and see its service DOWN in red, first`, async () => {
        cliHelper
          .execute(
            `docker exec ${pxc.container} mysqladmin -uroot -S /var/lib/pxc/node${pxcNode}/mysql.sock shutdown`,
          )
          .assertSuccess();
        await dashboard.selectVariableValue('Node Name', pxc.nodeName);
        await verifyRows(
          async () => {
            const [first, ...rest] = await dashboard.getTableRowsAfterRefresh(servicesPanel);

            return { first, rest: sortedRows(rest) };
          },
          { first: { Service: downService, Status: nodeSummary.services.down, Type: 'MySQL' }, rest: upRows },
          Timeouts.TWO_MINUTES,
        );
        await expect(dashboard.builders.tableCell(servicesPanel, 0, 2)).toHaveCSS('color', statusColors.DOWN);
        await expect(dashboard.builders.tableCell(servicesPanel, 1, 2)).toHaveCSS('color', statusColors.UP);
      });

      await verifyRows(sortedTypes, typeRows(pxc.service.node_id), Timeouts.TWO_MINUTES);

      await pmmTest.step(`Start PXC node ${pxcNode} and see every service UP again`, async () => {
        cliHelper.execute(startNode(pxc.container)).assertSuccess();
        await verifyRows(
          sortedServices,
          serviceRows(pxc.service.node_id, nodeSummary.services.up),
          Timeouts.FIVE_MINUTES,
        );
      });
    },
  );
});

pmmTest.describe('Node Summary disk panels under load', () => {
  const dmName = 'qa-pmm-15901';
  const backingFile = '/tmp/qa-pmm-15901-dm.img';
  let loopDevice = '';

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.execute(`sudo dmsetup remove ${dmName}`).assertSuccess();
    cliHelper.execute(`sudo losetup -d ${loopDevice}`).assertSuccess();
    cliHelper.execute(`sudo rm -f ${backingFile}`).assertSuccess();
  });

  // eslint-disable-next-line playwright/no-skipped-test -- PMM-15999: Disk IO Utilization goes above 100% on a saturated disk; unskip once PMM-15999 is fixed.
  pmmTest.skip(
    'PMM-15901 - Disk panels match the host @node-summary',
    async ({ api, cliHelper, dashboard, dockerHelper, page, urlHelper }) => {
      const { nodeSummary } = dashboard.os;
      const { panelName: operationsPanel, read, write } = nodeSummary.diskOperations;
      const pxc = await frameworkNode(api, dockerHelper, '^pxc_node__1_');
      const url = urlHelper.buildUrlWithParameters(nodeSummary.url, {
        from: 'now-15m',
        nodeName: pxc.nodeName,
        to: 'now',
      });

      await pmmTest.step('Open Node Summary for the PXC node and see the disk panels', async () => {
        await page.goto(url);
        await dashboard.loadAllPanels();
        await dashboard.verifyPanelsDisplayed(nodeSummary.diskPanels);
      });

      const dmDevice = await pmmTest.step('Write and read through a device-mapper device', async () => {
        cliHelper.execute(`sudo truncate -s 512M ${backingFile}`).assertSuccess();
        loopDevice = cliHelper.execute(`sudo losetup -f --show ${backingFile}`).assertSuccess().stdout.trim();
        cliHelper
          .execute(
            `sudo dmsetup create ${dmName} --table "0 $(sudo blockdev --getsz ${loopDevice}) linear ${loopDevice} 0"`,
          )
          .assertSuccess();
        // More writes than reads, so a Write line drawn above the axis would sit above Read.
        cliHelper
          .execute(`sudo dd if=/dev/zero of=/dev/mapper/${dmName} bs=4k count=100000 oflag=direct`)
          .assertSuccess();
        cliHelper
          .execute(`sudo dd if=/dev/mapper/${dmName} of=/dev/null bs=4k count=20000 iflag=direct`)
          .assertSuccess();

        return cliHelper
          .execute(`basename "$(readlink -f /dev/mapper/${dmName})"`)
          .assertSuccess()
          .stdout.trim();
      });

      await expect
        .poll(
          () =>
            api.prometheusApi.instantQueryValue(
              `increase(node_disk_io_time_seconds_total{node_name="${pxc.nodeName}",device="${dmDevice}"}[5m])`,
            ),
          { message: `PMM should have ${dmDevice}'s busy time`, timeout: Timeouts.TWO_MINUTES },
        )
        .toBeGreaterThan(0);

      await pmmTest.step('Reload and see Read above the axis and Write below it', async () => {
        await page.goto(url);
        await dashboard.loadAllPanels();
        await expect(dashboard.builders.panelLegendSeries(operationsPanel)).toHaveText([read, write]);
        expect(await dashboard.getSeriesMedianY(operationsPanel, read)).toBeLessThan(
          await dashboard.getSeriesMedianY(operationsPanel, write),
        );
      });

      await pmmTest.step(`See physical disks only in Disk IO Utilization, not ${dmDevice}`, async () => {
        const devices = (
          await dashboard.builders.panelLegendSeries(nodeSummary.diskUtilization).allInnerTexts()
        ).map((device) => device.trim());

        expect(devices).not.toHaveLength(0);
        expect(devices.filter((device) => /^(dm-|md)/.test(device))).toEqual([]);
      });

      await pmmTest.step(
        'See Disk Space equal to the real filesystems df lists, once per device',
        async () => {
          const sizes = new Map(
            cliHelper
              .execute(`docker exec ${pxc.container} df -B1 --output=source,fstype,size`)
              .assertSuccess()
              .getStdOutLines()
              .slice(1)
              .map((line) => line.trim().split(/\s+/))
              .filter(
                ([, fstype]) =>
                  !/^(rootfs|selinuxfs|autofs|rpc_pipefs|tmpfs|shm|overlay|squashfs)$/.test(fstype),
              )
              .map(([source, , size]) => [source, Number(size)]),
          );
          const totalBytes = [...sizes.values()].reduce((sum, size) => sum + size, 0);

          expect(sizes.size).toBeGreaterThan(0);
          await expect(dashboard.builders.panelContentByExactName(nodeSummary.diskSpace)).toHaveText(
            `${(totalBytes / 1_024 ** 3).toFixed(2)} GiB`,
          );
        },
      );
    },
  );
});

pmmTest.describe('Node Summary with a kernel file limit', () => {
  let originalFileMax = '';

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.execute(`sudo sysctl -w fs.file-max=${originalFileMax}`).assertSuccess();
  });

  pmmTest(
    'PMM-15901 - File descriptors with no limit @node-summary',
    async ({ api, cliHelper, dashboard, page, urlHelper }) => {
      const { fileDescriptors, url } = dashboard.os.nodeSummary;
      const nodeName = await api.haApi.getPmmServerNodeName();
      const readFileMax = () => cliHelper.execute('cat /proc/sys/fs/file-max').assertSuccess().stdout.trim();

      originalFileMax = readFileMax();

      const noLimitSince = await pmmTest.step('Remove the kernel file limit', async () => {
        cliHelper.execute(`sudo sysctl -w fs.file-max=${fileDescriptors.noLimit}`).assertSuccess();
        expect(readFileMax()).toEqual(fileDescriptors.noLimit);

        return String(Date.now());
      });

      // From the removal on, so a limit an earlier attempt set is not in the range.
      await pmmTest.step('See only Allocated, with a non-zero value', async () => {
        await expect(async () => {
          await page.goto(urlHelper.buildUrlWithParameters(url, { from: noLimitSince, nodeName, to: 'now' }));
          await dashboard.loadAllPanels();
          await expect(dashboard.builders.panelLegendSeries(fileDescriptors.panelName)).toHaveText(
            [fileDescriptors.allocated],
            { timeout: Timeouts.FIVE_SECONDS },
          );
        }).toPass({ intervals: [Timeouts.THIRTY_SECONDS], timeout: Timeouts.FIVE_MINUTES });
        await expect(
          dashboard.builders.legendMaxValue(fileDescriptors.panelName, fileDescriptors.allocated),
        ).toHaveText(/^[1-9][\d.]* K$/);
      });

      await pmmTest.step(`Set a ${fileDescriptors.setLimit} file limit and see the Limit line`, async () => {
        cliHelper.execute(`sudo sysctl -w fs.file-max=${fileDescriptors.setLimit}`).assertSuccess();
        await expect(async () => {
          await page.goto(urlHelper.buildUrlWithParameters(url, { from: 'now-5m', nodeName, to: 'now' }));
          await dashboard.loadAllPanels();
          await expect(dashboard.builders.panelLegendSeries(fileDescriptors.panelName)).toHaveText(
            [fileDescriptors.limit, fileDescriptors.allocated],
            { timeout: Timeouts.FIVE_SECONDS },
          );
        }).toPass({ intervals: [Timeouts.THIRTY_SECONDS], timeout: Timeouts.FIVE_MINUTES });
        await expect(
          dashboard.builders.legendMaxValue(fileDescriptors.panelName, fileDescriptors.limit),
        ).toHaveText(fileDescriptors.limitValue);
      });
    },
  );
});

pmmTest(
  'PMM-15901 - All panels show data, new Disk panels included @node-summary',
  async ({ api, dashboard, page, urlHelper }) => {
    const { nodeSummary } = dashboard.os;

    await page.goto(
      urlHelper.buildUrlWithParameters(nodeSummary.url, {
        from: 'now-1h',
        nodeName: await api.haApi.getPmmServerNodeName(),
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(nodeSummary.metrics);
    await expect(dashboard.builders.tableColumnHeaders(nodeSummary.services.panelName)).toHaveText(
      nodeSummary.services.columns,
    );
    await dashboard.verifyAllPanelsHaveData(nodeSummary.noDataMetrics);
  },
);

pmmTest.describe('Node Summary after re-registering a node', () => {
  let valkey: Awaited<ReturnType<typeof frameworkNode>>;

  pmmTest.afterEach(async ({ cliHelper, credentials }) => {
    const { address, cluster, custom_labels, environment, port, service_name } = valkey.service;
    const labels = Object.entries(custom_labels ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    cliHelper.removeService(valkey.container, ServiceType.valkey, service_name);
    cliHelper
      .execute(
        `docker exec ${valkey.container} pmm-admin add valkey --service-name=${service_name} --cluster=${cluster} --custom-labels=${labels} --environment=${environment} --username=${credentials.valkey.username} --password=${credentials.valkey.password} --host=${address} --port=${port}`,
      )
      .assertSuccess();
  });

  pmmTest(
    'PMM-15901 - System Summary after re-registering a node @node-summary',
    async ({ api, cliHelper, dashboard, dockerHelper, nodesPage, page, urlHelper }) => {
      const { nodeSummary } = dashboard.os;
      const summaryUrl = () =>
        urlHelper.buildUrlWithParameters(nodeSummary.url, {
          from: 'now-1h',
          nodeName: valkey.nodeName,
          to: 'now',
        });

      valkey = await frameworkNode(api, dockerHelper, '^valkey-primary-1-svc$');
      installPerl(cliHelper, valkey.container);

      await pmmTest.step('Open Node Summary for the Valkey node', async () => {
        await page.goto(summaryUrl());
        await expect(dashboard.elements.summaryFingerprint).toContainText(
          nodeSummary.systemSummaryHostname(valkey.hostname),
          { timeout: Timeouts.TWO_MINUTES },
        );
      });

      await pmmTest.step('Register the Valkey node again under the same name', async () => {
        const serverUrl = `https://admin:${encodeURIComponent(process.env.ADMIN_PASSWORD || 'admin')}@pmm-server:8443`;
        const output = cliHelper
          .execute(
            `docker exec ${valkey.container} pmm-admin config --server-insecure-tls --server-url=${CliHelper.shellQuote(serverUrl)} --force ${dockerHelper.getContainerAddress(valkey.container)} container ${valkey.nodeName}`,
          )
          .assertSuccess();

        expect(output.stdout).toContain('Registered.');
      });

      await pmmTest.step('See one node with that name, under a new ID', async () => {
        const nodes = (await api.inventoryApi.getAllNodes()).filter(
          ({ node_name }) => node_name === valkey.nodeName,
        );

        expect(nodes).toHaveLength(1);
        expect(nodes[0].node_id).not.toEqual(valkey.service.node_id);
        await page.goto(nodesPage.url);
        await expect(nodesPage.builders.nodeRow(valkey.nodeName)).toHaveCount(1, {
          timeout: Timeouts.THIRTY_SECONDS,
        });
      });

      await pmmTest.step('See the Valkey node report in System Summary again', async () => {
        await expect(async () => {
          await page.goto(summaryUrl());
          await expect(dashboard.elements.summaryFingerprint).toContainText(
            nodeSummary.systemSummaryHostname(valkey.hostname),
            { timeout: Timeouts.THIRTY_SECONDS },
          );
        }).toPass({ intervals: [Timeouts.THIRTY_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });
    },
  );
});
