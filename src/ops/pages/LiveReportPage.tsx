import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ExternalLink, Maximize2, Minimize2, RefreshCw, Signal, Wifi } from 'lucide-react';
import { Button } from '../components/ui/button';
import { buildLiveReportUrl, LIVE_REPORTS, type LiveReportKey } from '../lib/liveReports';
import { cn } from '../lib/utils';

type LiveReportPageProps = {
  reportKey: LiveReportKey;
};

function formatRefreshTime(value: Date): string {
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getConfiguredSource(reportKey: LiveReportKey): string {
  const report = LIVE_REPORTS[reportKey];
  const envValue = import.meta.env[report.envKey];
  return typeof envValue === 'string' && envValue.trim() ? envValue : report.sourceUrl;
}

export default function LiveReportPage({ reportKey }: LiveReportPageProps) {
  const report = LIVE_REPORTS[reportKey];
  const sourceUrl = getConfiguredSource(reportKey);
  const frameUrl = useMemo(() => buildLiveReportUrl(sourceUrl), [sourceUrl]);
  const [frameKey, setFrameKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  const refreshReport = useCallback(() => {
    setIsLoading(true);
    setIsSlow(false);
    setLastRefresh(new Date());
    setFrameKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => setIsSlow(true), 7000);
    return () => window.clearTimeout(timer);
  }, [frameKey, isLoading]);

  return (
    <div className={cn(
      'flex flex-col gap-4 -m-5 min-h-[calc(100vh-4.5rem)] p-5 pb-3 animate-in fade-in duration-300',
      isFocusMode && 'gap-3'
    )}>
      <div className="shrink-0 rounded-xl border border-border bg-card/80 p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[9.5px] font-bold uppercase tracking-[1.5px]">
              <span className="text-gc-orange">{report.kicker}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
                <Wifi className="h-3 w-3" />
                Refreshed {formatRefreshTime(lastRefresh)}
              </span>
            </div>
            <h2 className="font-condensed font-extrabold text-[24px] tracking-tight text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-gc-purple" />
              {report.title}
            </h2>
            {!isFocusMode && (
              <p className="text-muted-foreground text-[12px] max-w-3xl leading-relaxed">
                {report.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={refreshReport}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isLoading && 'animate-spin')} />
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsFocusMode((value) => !value)}>
              {isFocusMode ? <Minimize2 className="h-3.5 w-3.5 mr-1.5" /> : <Maximize2 className="h-3.5 w-3.5 mr-1.5" />}
              {isFocusMode ? 'Standard view' : 'Focus view'}
            </Button>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Open full app
            </a>
          </div>
        </div>
      </div>

      <div className={cn(
        'relative flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm',
        isFocusMode ? 'min-h-[calc(100vh-9.5rem)]' : 'min-h-[min(720px,calc(100vh-15rem))]'
      )}>
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <Signal className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-foreground">{report.title}</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[1px] text-muted-foreground">
            {isLoading ? 'Loading' : 'Online'}
          </div>
        </div>

        {isLoading && !isSlow && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-center shadow-sm">
              <RefreshCw className="mx-auto h-4 w-4 animate-spin text-gc-orange" />
              <p className="mt-2 text-xs font-bold text-foreground">Loading live report</p>
            </div>
          </div>
        )}

        {isSlow && (
          <div className="absolute bottom-3 left-3 z-20 max-w-sm rounded-lg border border-border bg-background/95 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground shadow-sm backdrop-blur">
            Streamlit may be waking up. You can wait here, refresh, or open the full app in a new tab.
          </div>
        )}

        <iframe
          key={frameKey}
          title={report.frameTitle}
          src={frameUrl}
          className={cn(
            'w-full border-0 bg-background pt-9',
            isFocusMode ? 'h-[calc(100vh-9.5rem)] min-h-[calc(100vh-9.5rem)]' : 'h-full min-h-[min(720px,calc(100vh-15rem))]'
          )}
          allow="fullscreen; clipboard-read; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
          loading="lazy"
          onLoad={() => {
            setIsLoading(false);
            setIsSlow(false);
          }}
        />
      </div>
    </div>
  );
}
