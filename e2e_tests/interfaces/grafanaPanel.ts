export type GrafanaPanelType =
  | 'timeSeries'
  | 'table'
  | 'text'
  | 'stat'
  | 'gauge'
  | 'polyStat'
  | 'barGauge'
  | 'summary'
  | 'unknown';

export interface GrafanaPanel {
  name: string;
  type: GrafanaPanelType;
}
