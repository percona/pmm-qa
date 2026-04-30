export interface GrafanaUser {
  id: number;
  login: string;
  name?: string;
}

export interface GrafanaUserSearchResponse {
  users: GrafanaUser[];
}
