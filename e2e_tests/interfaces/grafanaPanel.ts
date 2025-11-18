export type GrafanaPanelType =
  | 'timeSeries'
  | 'table'
  | 'text'
  | 'stat'
  | 'gauge'
  | 'polyStat'
  | 'barGauge'
  | 'unknown';

export interface GrafanaPanel {
  name: string;
  type: GrafanaPanelType;
}
