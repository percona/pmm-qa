export interface GrafanaDatasource {
  id: number;
  name: string;
  type: string;
  uid: string;
}

export interface GrafanaUser {
  id: number;
  isGrafanaAdmin?: boolean;
  login: string;
  name?: string;
}

export interface GrafanaUserSearchResponse {
  users: GrafanaUser[];
}

export interface GrafanaDashboard {
  uid: string;
  url: string;
}
