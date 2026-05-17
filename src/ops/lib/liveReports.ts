export type LiveReportKey = 'system' | 'dropbox';

export type LiveReportDefinition = {
  title: string;
  kicker: string;
  description: string;
  sourceUrl: string;
  envKey: string;
  frameTitle: string;
};

export const LIVE_REPORTS: Record<LiveReportKey, LiveReportDefinition> = {
  system: {
    title: 'System live report',
    kicker: 'Command Center telemetry',
    description: 'Live Streamlit workspace for system health, operating signals, and management reporting.',
    sourceUrl: 'https://try-dashboard.streamlit.app',
    envKey: 'VITE_STREAMLIT_DASHBOARD_URL',
    frameTitle: 'System live report workspace',
  },
  dropbox: {
    title: 'Dropbox live report',
    kicker: 'Dropbox workspace telemetry',
    description: 'Live Streamlit workspace for Dropbox activity, files, and operational visibility.',
    sourceUrl: 'https://try-dropbox.streamlit.app/',
    envKey: 'VITE_DROPBOX_REPORT_URL',
    frameTitle: 'Dropbox live report workspace',
  },
};

export function buildLiveReportUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/$/, '');
  const url = new URL(normalized);
  url.searchParams.set('embed', 'true');
  return url.toString();
}
