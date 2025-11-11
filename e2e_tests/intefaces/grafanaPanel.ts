export type GrafanaPanelType =
  | 'timeSeries'
  | 'table'
  | 'stat'
  | 'gauge'
  | 'polyStat'
  | 'barGauge'
  | 'pie'
  | 'custom'
  | 'unknown';

export interface GrafanaPanel {
  name: string;
  type: GrafanaPanelType;
}
