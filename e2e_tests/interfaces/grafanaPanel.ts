export type GrafanaPanelType =
  | 'timeSeries'
  | 'table'
  | 'text'
  | 'stat'
  | 'gauge'
  | 'polyStat'
  | 'barGauge'
  | 'pie'
  | 'custom'
  | 'barTime'
  | 'stateTime'
  | 'summary'
  | 'unknown'
  | 'empty';

export interface GrafanaPanel {
  name: string;
  type: GrafanaPanelType;
}
