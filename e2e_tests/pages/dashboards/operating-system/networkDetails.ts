import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

const burstConnections = 2_000;
const connectionOpens = ['activeOpens', 'passiveOpens'];
const connectionProblems = ['estabResets', 'attemptfails', 'retransSegs'];

export default class NetworkDetailsDashboard implements DashboardInterface {
  url = 'graph/d/node-network/network-details';
  metrics: GrafanaPanel[] = [
    { name: 'Inbound Speed', type: 'stat' },
    { name: 'Outbound Speed', type: 'stat' },
    { name: 'Traffic Errors and Drops', type: 'stat' },
    { name: 'Retransmit rate', type: 'stat' },
    { name: 'Network Traffic', type: 'timeSeries' },
    { name: 'Network Utilization Hourly', type: 'timeSeries' },
    { name: 'Network Traffic by Packets', type: 'timeSeries' },
    { name: 'Network Traffic Errors', type: 'timeSeries' },
    { name: 'Network Traffic Drop', type: 'timeSeries' },
    { name: 'Network Traffic Multicast', type: 'timeSeries' },
    { name: 'The algorithm used to determine the timeout value', type: 'stat' },
    { name: 'Min TCP Retransmission timeout', type: 'stat' },
    { name: 'Max TCP Retransmission timeout', type: 'stat' },
    { name: 'Netstat: TCP', type: 'timeSeries' },
    { name: 'TCP Segments', type: 'timeSeries' },
    { name: 'Netstat: UDP', type: 'timeSeries' },
    { name: 'UDP Lite', type: 'timeSeries' },
    { name: 'ICMP Errors', type: 'timeSeries' },
    { name: 'Messages / Redirects', type: 'timeSeries' },
    { name: 'Echos', type: 'timeSeries' },
    { name: 'Timestamps / Mask Requests', type: 'timeSeries' },
  ];
  netstatTcp = {
    connectionOpens,
    connectionProblems,
    established: 'established',
    establishedLegend: 'established (right y-axis)',
    // 127.0.0.1, not localhost: curl tries ::1 first and doubles the connections.
    localBurst: {
      command: `docker exec pmm-server sh -c 'for i in $(seq 1 ${burstConnections}); do curl -ks -o /dev/null -w "%{http_code}\\n" https://127.0.0.1:8443/; done' | sort | uniq -c`,
      connections: burstConnections,
      output: `${burstConnections} 302`,
    },
    maxProblemRate: 30,
    name: 'Netstat: TCP',
    rateUnit: 'ops',
    rateValue: /^\d+(\.\d+)? ops\/s$/,
    rightAxisOverride: {
      matcher: { id: 'byName', options: 'established' },
      properties: [
        { id: 'custom.axisPlacement', value: 'right' },
        { id: 'custom.axisLabel', value: 'Connections' },
      ],
    },
    series: ['established', ...connectionOpens, ...connectionProblems],
    tensOfOpsFrom: 10,
    tensOfOpsUpTo: 100,
  };
  noDataMetrics = ['Network Utilization Hourly'];
}
