import { describe, expect, it } from 'vitest';
import { buildLiveReportUrl, LIVE_REPORTS } from './liveReports';

describe('live report definitions', () => {
  it('defines system and Dropbox live reports with Streamlit frame URLs', () => {
    expect(LIVE_REPORTS.system.title).toBe('System live report');
    expect(LIVE_REPORTS.system.sourceUrl).toBe('https://try-dashboard.streamlit.app');
    expect(buildLiveReportUrl(LIVE_REPORTS.system.sourceUrl)).toBe('https://try-dashboard.streamlit.app/?embed=true');

    expect(LIVE_REPORTS.dropbox.title).toBe('Dropbox live report');
    expect(LIVE_REPORTS.dropbox.sourceUrl).toBe('https://try-dropbox.streamlit.app/');
    expect(buildLiveReportUrl(LIVE_REPORTS.dropbox.sourceUrl)).toBe('https://try-dropbox.streamlit.app/?embed=true');
  });

  it('keeps visible report copy free of disallowed wording', () => {
    const visibleCopy = Object.values(LIVE_REPORTS)
      .flatMap((report) => [report.title, report.kicker, report.description, report.frameTitle])
      .join(' ')
      .toLowerCase();

    expect(visibleCopy).not.toContain('embed');
  });
});
