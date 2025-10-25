export type GrafanaPanelType =
  | 'timeSeries'
  | 'table'
  | 'stat'
  | 'gauge'
  | 'barGauge'
  | 'pie'
  | 'custom'
  | 'unknown';

export interface GrafanaPanel {
  name: string;
  type: GrafanaPanelType;
}
