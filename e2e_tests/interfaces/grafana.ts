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
