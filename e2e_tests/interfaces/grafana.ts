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
