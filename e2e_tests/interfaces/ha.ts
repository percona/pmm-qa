export enum HaNodeRole {
  follower = 'NODE_ROLE_FOLLOWER',
  leader = 'NODE_ROLE_LEADER',
  unspecified = 'NODE_ROLE_UNSPECIFIED',
}

export interface HaNode {
  nodeName: string;
  role: HaNodeRole;
  status: string;
}

export interface HaNodesResponse {
  expectedNodes: number;
  nodes: HaNode[];
}

export interface HaStatusResponse {
  status: string;
}
