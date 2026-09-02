export enum HaNodeRole {
  follower = 'NODE_ROLE_FOLLOWER',
  leader = 'NODE_ROLE_LEADER',
  unspecified = 'NODE_ROLE_UNSPECIFIED',
}

// grpc-gateway marshals with UseProtoNames, so the JSON is snake_case - not the
// camelCase the PMM UI's own types use.
export interface HaNode {
  node_name: string;
  role: HaNodeRole;
  status: string;
}

export interface HaNodesResponse {
  expected_nodes: number;
  nodes: HaNode[];
}

export interface HaStatusResponse {
  status: string;
}

/** What {@link HaClusterHelper.failoverLeaderWhileProbing} saw on the public URL during a failover. */
export interface HaFailoverProbe {
  failures: number;
  longestOutage: number;
  newLeader: string;
  probes: number;
}
