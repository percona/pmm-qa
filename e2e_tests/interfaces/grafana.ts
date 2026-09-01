export interface GrafanaDatasource {
  id: number;
  name: string;
  type: string;
  uid: string;
}

export interface GrafanaUser {
  id: number;
  login: string;
  name?: string;
}

export interface GrafanaUserSearchResponse {
  users: GrafanaUser[];
}

export interface GrafanaFolder {
  id: number;
  uid: string;
  title: string;
  managedBy: string;
}
