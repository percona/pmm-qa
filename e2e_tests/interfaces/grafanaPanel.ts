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
  | 'singleStateTime'
  | 'summary'
  | 'unknown'
  | 'empty';

export interface GrafanaPanel {
  name: string;
  type: GrafanaPanelType;
}
