import { GrafanaPanel } from '@interfaces/grafanaPanel';

export type AccessServiceType = 'mongodb' | 'mysql' | 'postgresql';

export interface AccessRole {
  filter: string;
  title: string;
}

export interface AccessRoleDetails extends AccessRole {
  role_id: number | string;
}

export interface AccessRoleResponse {
  roles: AccessRoleDetails[];
}

export interface AccessUserScenario {
  allowedPanels: GrafanaPanel[];
  role: AccessRole;
  disallowedDashboards: {
    menuItem: AccessServiceType;
    panels: string[];
  }[];
  password: string;
  serviceType: AccessServiceType;
  username: string;
}
