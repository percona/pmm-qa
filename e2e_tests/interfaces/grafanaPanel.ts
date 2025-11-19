export type GrafanaPanelType =
  | 'timeSeries'
  | 'table'
  | 'text'
  | 'stat'
  | 'gauge'
  | 'polyStat'
  | 'barGauge'
  | 'stateTime'
  | 'summary'
  | 'unknown';

export interface GrafanaPanel {
  name: string;
  type: GrafanaPanelType;
}
