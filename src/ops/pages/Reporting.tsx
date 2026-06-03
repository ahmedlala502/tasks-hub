import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  CheckSquare,
  Clock3,
  Download,
  FileSpreadsheet,
  FolderKanban,
  Handshake,
  RotateCcw,
  Search,
  ShieldAlert,
  Users2,
  Workflow,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../App';
import { DEFAULT_ACCESS_USERS } from '../auth/defaultAccessUsers';
import { getOfficeFromProfile, OPS_OFFICES, type OpsOffice, type OpsRole, type OpsUser } from '../auth/types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { ATTACHED_EXPORT_USERS, dataService } from '../services/dataService';
import { exportRows, exportRowsAsCsv, exportWorkbook } from '../services/spreadsheetService';
import {
  filterBlockersByRole,
  filterCampaignsByRole,
  filterHandoversByRole,
  filterTasksByRole,
} from '../lib/workspace';
import { INITIAL_MEMBERS } from '../../constants';
import { isReportVisibleUser, isVisibleInReports } from '../lib/reportVisibility';
import {
  buildFullAnalysisHub,
  defaultAnalysisFilters,
  type AnalysisDataRow,
  type AnalysisFilters,
  type AnalysisPillarKey,
  type EmployeeBreakdown,
} from '../lib/fullAnalysisHub';
import type { OfficeUser } from '../lib/officeInsights';

const CHART_COLORS = ['#f97316', '#8b5cf6', '#14b8a6', '#6366f1', '#22c55e', '#ef4444', '#0ea5e9', '#f59e0b'];

const PILLAR_ICONS: Record<AnalysisPillarKey, React.ComponentType<{ className?: string }>> = {
  employees: Users2,
  tasks: CheckSquare,
  campaigns: FolderKanban,
  handovers: Handshake,
  blockers: ShieldAlert,
  sla: Clock3,
  teams: Workflow,
  offices: BriefcaseBusiness,
};

const PILLAR_TONES: Record<AnalysisPillarKey, string> = {
  employees: '#8b5cf6',
  tasks: '#14b8a6',
  campaigns: '#0ea5e9',
  handovers: '#6366f1',
  blockers: '#ef4444',
  sla: '#22c55e',
  teams: '#f59e0b',
  offices: '#f97316',
};

function normalize(value: string | undefined | null): string {
  return (value || '').trim();
}

function normalizeLower(value: string | undefined | null): string {
  return normalize(value).toLowerCase();
}

function isPillarKey(value: unknown): value is AnalysisPillarKey {
  return ['employees', 'tasks', 'campaigns', 'handovers', 'blockers', 'sla', 'teams', 'offices'].includes(value as string);
}

function roleFromObservedName(name: string): OpsRole {
  const text = normalizeLower(name);
  return text.includes('community') || text.includes('ksa') || text.includes('mona') || text.includes('abdulrahman') || text.includes('khalid') || text.includes('nurhan')
    ? 'community'
    : 'operations';
}

function uniqueOfficeUsers(users: OfficeUser[]): OfficeUser[] {
  const byName = new Map<string, OfficeUser>();
  users.forEach((user) => {
    const key = normalizeLower(user.displayName);
    if (!key || byName.has(key)) return;
    byName.set(key, user);
  });
  return [...byName.values()];
}

function optionList(values: string[], manualValues: string[] = []) {
  return [...new Set([...manualValues, ...values].filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export default function Reporting() {
  const { role, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cloudUsers, setCloudUsers] = useState<OpsUser[]>([]);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [filters, setFilters] = useState<AnalysisFilters>(() => {
    const pillar = isPillarKey(searchParams.get('pillar')) ? searchParams.get('pillar') as AnalysisPillarKey : 'employees';
    const officeParam = searchParams.get('office');
    return {
      ...defaultAnalysisFilters(pillar),
      office: OPS_OFFICES.includes(officeParam as OpsOffice) ? officeParam as OpsOffice : 'all',
    };
  });

  useEffect(() => {
    const pillarParam = searchParams.get('pillar');
    const officeParam = searchParams.get('office');
    setFilters((current) => ({
      ...current,
      pillar: isPillarKey(pillarParam) ? pillarParam : current.pillar,
      office: OPS_OFFICES.includes(officeParam as OpsOffice) ? officeParam as OpsOffice : officeParam ? current.office : 'all',
    }));
  }, [searchParams]);

  useEffect(() => {
    if (role !== 'master') return;
    let alive = true;
    import('../services/adminApi').then(({ adminApi }) => {
      adminApi.listUsers()
        .then((users) => {
          if (alive) setCloudUsers(users);
        })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [role]);

  useEffect(() => {
    return dataService.subscribeToWorkspaceChanges(() => {
      setWorkspaceVersion((version) => version + 1);
    }, ['tasks', 'handovers', 'blockers', 'campaigns', 'influencers']);
  }, []);

  const workspaceData = useMemo(() => {
    return {
      tasks: filterTasksByRole(role, dataService.getTasks()),
      handovers: filterHandoversByRole(role, dataService.getHandovers()),
      blockers: filterBlockersByRole(role, dataService.getBlockers()),
      campaigns: filterCampaignsByRole(role, dataService.getCampaigns()),
    };
  }, [role, workspaceVersion]);

  const directoryUsers = useMemo(() => {
    const observedNames = new Set<string>();
    workspaceData.tasks.forEach((task) => observedNames.add(normalize(task.ownerId)));
    workspaceData.handovers.forEach((handover) => {
      observedNames.add(normalize(handover.outgoingLead));
      observedNames.add(normalize(handover.incomingLead));
    });
    workspaceData.blockers.forEach((blocker) => observedNames.add(normalize(blocker.ownerId)));
    workspaceData.campaigns.forEach((campaign) => {
      observedNames.add(normalize(campaign.currentOwner));
      campaign.internalOwners?.forEach((owner) => observedNames.add(normalize(owner)));
    });

    const memberMap = new Map(INITIAL_MEMBERS.map((member) => [normalizeLower(member.name), member]));
    const visibleObservedNames = [...observedNames].filter((name) => Boolean(name) && isVisibleInReports(name));

    const users: OfficeUser[] = [
      ...DEFAULT_ACCESS_USERS.filter(isReportVisibleUser).map((item) => ({
        displayName: item.name,
        email: item.email,
        role: item.role,
        status: 'active' as const,
        office: item.office,
        department: item.department,
        title: item.title,
      })),
      ...ATTACHED_EXPORT_USERS.filter(isReportVisibleUser).map((item) => ({
        displayName: item.displayName,
        email: item.email,
        role: item.role,
        status: item.status,
        office: item.office,
        department: item.department,
        title: item.title,
      })),
      ...cloudUsers.filter(isReportVisibleUser).map((item) => ({
        displayName: item.displayName,
        email: item.email,
        role: item.role,
        status: item.status,
        office: item.office,
        department: item.department,
        title: item.title,
      })),
      ...(user && isReportVisibleUser(user) ? [{
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        status: user.status,
        office: user.office,
        department: user.department,
        title: user.title,
      }] : []),
      ...visibleObservedNames.map((name) => {
        const member = memberMap.get(normalizeLower(name));
        const inferredRole = roleFromObservedName(name);
        return {
          displayName: name,
          email: '',
          role: inferredRole,
          status: 'active' as const,
          office: getOfficeFromProfile({ name, role: inferredRole, office: member?.office }),
          department: member?.team || (inferredRole === 'community' ? 'Coordination' : 'Operations'),
          title: member?.role || 'Workspace Owner',
        };
      }),
    ];

    return uniqueOfficeUsers(users);
  }, [cloudUsers, user, workspaceData]);

  const analysis = useMemo(() => buildFullAnalysisHub({
    users: directoryUsers,
    tasks: workspaceData.tasks,
    campaigns: workspaceData.campaigns,
    handovers: workspaceData.handovers,
    blockers: workspaceData.blockers,
    filters,
  }), [directoryUsers, filters, workspaceData]);

  const selectedReport = analysis.reports[filters.pillar];
  const tableRows = selectedReport.filteredRows;
  const tableColumns = tableRows[0] ? Object.keys(tableRows[0]) : selectedReport.rows[0] ? Object.keys(selectedReport.rows[0]) : [];

  const chart = useMemo(() => {
    const rows = tableRows.slice(0, 8);
    if (!rows.length) return { labelKey: '', valueKey: '', rows: [] as AnalysisDataRow[] };
    const firstRow = rows[0];
    const keys = Object.keys(firstRow);
    const labelKey = keys.find((key) => typeof firstRow[key] === 'string') || keys[0];
    const valueKey = keys.find((key) => typeof firstRow[key] === 'number') || keys[1] || keys[0];
    return { labelKey, valueKey, rows };
  }, [tableRows]);

  const setFilter = <K extends keyof AnalysisFilters>(key: K, value: AnalysisFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key === 'pillar') {
      const next = new URLSearchParams(searchParams);
      next.set('pillar', String(value));
      if (String(value) !== 'offices') next.delete('office');
      setSearchParams(next);
    }
    if (key === 'office') {
      const next = new URLSearchParams(searchParams);
      next.set('pillar', filters.pillar);
      if (value === 'all') next.delete('office');
      else next.set('office', String(value));
      setSearchParams(next);
    }
  };

  const resetFilters = () => {
    const reset = defaultAnalysisFilters(filters.pillar);
    setFilters(reset);
    const next = new URLSearchParams(searchParams);
    next.set('pillar', filters.pillar);
    next.delete('office');
    setSearchParams(next);
  };

  const exportCurrentXlsx = () => exportRows(`trygc_${filters.pillar}_analysis.xlsx`, selectedReport.filteredRows);
  const exportCurrentCsv = () => exportRowsAsCsv(`trygc_${filters.pillar}_analysis.csv`, selectedReport.filteredRows);
  const exportAllWorkbook = () => exportWorkbook('trygc_full_analysis_hub.xlsx', analysis.exportSheets);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gc-orange">Reporting Center</p>
          <h1 className="font-condensed text-[30px] font-extrabold uppercase tracking-tight">Full Analysis Hub</h1>
          <p className="mt-1 max-w-3xl text-[12px] font-medium text-muted-foreground">
            Filter every operational pillar by employee, task, campaign, handover, office, status, priority, and search, then export the exact analysis.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={exportAllWorkbook} className="h-10 bg-gc-orange text-white hover:bg-gc-orange/90">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export All Pillars
          </Button>
          <Button variant="outline" onClick={exportCurrentXlsx} className="h-10">
            <Download className="mr-2 h-4 w-4" />
            Export Filtered XLSX
          </Button>
          <Button variant="outline" onClick={exportCurrentCsv} className="h-10">
            <Download className="mr-2 h-4 w-4" />
            Export Filtered CSV
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {analysis.globalMetrics.map((metric) => (
          <Card key={String(metric.Label)} className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-[9.5px] font-extrabold uppercase tracking-widest text-muted-foreground">{metric.Label}</p>
              <p className="mt-2 font-condensed text-[28px] font-black leading-none text-foreground">{metric.Value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-condensed text-[18px] font-extrabold uppercase tracking-tight">Analysis Filters</CardTitle>
          <CardDescription>Combine filters to inspect the exact pillar view you need before exporting.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <SelectField
              label="Pillar"
              value={filters.pillar}
              onChange={(value) => setFilter('pillar', value as AnalysisPillarKey)}
              options={analysis.pillarOrder.map((key) => ({ value: key, label: analysis.reports[key].label }))}
            />
            <SelectField
              label="Employee"
              value={filters.employee}
              onChange={(value) => setFilter('employee', value)}
              options={[{ value: 'all', label: 'All Employees' }, ...analysis.options.employees.map((value) => ({ value, label: value }))]}
            />
            <SelectField
              label="Team"
              value={filters.team}
              onChange={(value) => setFilter('team', value)}
              options={[{ value: 'all', label: 'All Teams' }, ...analysis.options.teams.map((value) => ({ value, label: value }))]}
            />
            <SelectField
              label="Office"
              value={filters.office}
              onChange={(value) => setFilter('office', value as AnalysisFilters['office'])}
              options={analysis.options.offices.map((value) => ({ value, label: value === 'all' ? 'All Offices' : value }))}
            />
            <SelectField
              label="Campaign"
              value={filters.campaign}
              onChange={(value) => setFilter('campaign', value)}
              options={[{ value: 'all', label: 'All Campaigns' }, ...analysis.options.campaigns.map((value) => ({ value, label: value }))]}
            />
            <SelectField
              label="Status"
              value={filters.status}
              onChange={(value) => setFilter('status', value)}
              options={[{ value: 'all', label: 'All Statuses' }, ...optionList(analysis.options.statuses, ['Open']).map((value) => ({ value, label: value }))]}
            />
            <SelectField
              label="Priority"
              value={filters.priority}
              onChange={(value) => setFilter('priority', value)}
              options={[{ value: 'all', label: 'All Priority' }, ...analysis.options.priorities.map((value) => ({ value, label: value }))]}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Reset</span>
              <Button variant="outline" className="h-9 justify-center" onClick={resetFilters}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              placeholder="Search inside the selected analysis scope..."
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {analysis.pillarOrder.map((pillar) => {
          const report = analysis.reports[pillar];
          const Icon = PILLAR_ICONS[pillar];
          const tone = PILLAR_TONES[pillar];
          const isActive = filters.pillar === pillar;

          return (
            <button
              key={pillar}
              type="button"
              onClick={() => setFilter('pillar', pillar)}
              className={`rounded-lg border p-4 text-left transition-all ${
                isActive
                  ? 'border-gc-orange bg-gc-orange/8 shadow-[0_0_0_1px_rgba(249,115,22,0.15)]'
                  : 'border-border bg-card hover:border-gc-orange/40 hover:bg-secondary/30'
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${tone}18`, color: tone }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {report.filteredRows.length}/{report.rows.length}
                </Badge>
              </div>
              <p className="font-condensed text-[18px] font-extrabold uppercase tracking-tight">{report.label}</p>
              <p className="mt-1 min-h-[34px] text-[12px] font-semibold leading-snug text-muted-foreground">{report.description}</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <span className="font-condensed text-[28px] font-black leading-none">{report.value}</span>
                <span className="text-right text-[11px] font-bold leading-snug text-muted-foreground">{report.insight}</span>
              </div>
            </button>
          );
        })}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-condensed text-[18px] font-extrabold uppercase tracking-tight">
              <BarChart3 className="h-4 w-4 text-gc-orange" />
              {selectedReport.label} Spread
            </CardTitle>
            <CardDescription>{selectedReport.description}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chart.rows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey={chart.labelKey} stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey={chart.valueKey} radius={[6, 6, 0, 0]}>
                    {chart.rows.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No chartable data for the current filters." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="font-condensed text-[18px] font-extrabold uppercase tracking-tight">
              {selectedReport.label} Intelligence
            </CardTitle>
            <CardDescription>Current filtered readout for the selected pillar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InsightRow label="Selected Pillar" value={selectedReport.label} />
            <InsightRow label="Total Rows" value={String(selectedReport.rows.length)} />
            <InsightRow label="Filtered Rows" value={String(selectedReport.filteredRows.length)} />
            <InsightRow label="Key Insight" value={selectedReport.insight} />
            <InsightRow label="Exports" value="All pillars workbook + filtered XLSX/CSV" />
            <div className="rounded-lg border border-dashed border-gc-orange/30 bg-gc-orange/5 p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-gc-orange">Analysis Note</p>
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-muted-foreground">
                Workbook export includes every pillar using the active filters. Single-pillar exports use the table below.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {filters.pillar === 'employees' && analysis.employeeBreakdown ? (
        <EmployeeBreakdownView
          breakdown={analysis.employeeBreakdown}
          onOpenPillar={(pillar) => setFilter('pillar', pillar)}
        />
      ) : (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-condensed text-[20px] font-extrabold uppercase tracking-tight">
                {selectedReport.label} Detailed Analysis
              </CardTitle>
              <CardDescription>
                {filters.pillar === 'employees'
                  ? 'Choose an employee from the filter, or click a name below, to open a cross-pillar breakdown for that person.'
                  : `${tableRows.length} filtered rows from ${selectedReport.rows.length} total rows. Export buttons above use this filtered analysis.`}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {tableRows.length ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="border-border hover:bg-transparent">
                      {tableColumns.map((column) => (
                        <TableHead key={column} className="py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row, index) => (
                      <TableRow key={`${filters.pillar}-${index}`} className="border-border hover:bg-secondary/30">
                        {tableColumns.map((column) => (
                          <TableCell key={`${filters.pillar}-${index}-${column}`} className="max-w-[260px] truncate text-[12px] font-medium">
                            {filters.pillar === 'employees' && column === 'Employee' ? (
                              <button
                                type="button"
                                className="font-extrabold text-gc-orange underline-offset-4 hover:underline"
                                onClick={() => setFilter('employee', String(row[column]))}
                              >
                                {String(row[column] ?? '')}
                              </button>
                            ) : (
                              String(row[column] ?? '')
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState text="No rows match the current filters. Clear filters or export an empty workbook shell." />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmployeeBreakdownView({
  breakdown,
  onOpenPillar,
}: {
  breakdown: EmployeeBreakdown;
  onOpenPillar: (pillar: AnalysisPillarKey) => void;
}) {
  const profile = breakdown.profile;
  const headlineMetrics = [
    { label: 'Team', value: profile.Team },
    { label: 'Office', value: profile.Office },
    { label: 'Completion', value: profile.Completion },
    { label: 'Score', value: profile.Score },
  ];

  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gc-orange">Employee Breakdown</p>
            <CardTitle className="mt-1 font-condensed text-[24px] font-extrabold uppercase tracking-tight">
              {breakdown.selectedEmployee}
            </CardTitle>
            <CardDescription className="mt-1">
              Every pillar below is filtered to this employee: tasks, campaigns, handovers, blockers, SLA, team, and office context.
            </CardDescription>
          </div>
          <div className="grid min-w-[min(100%,520px)] grid-cols-2 gap-2 lg:grid-cols-4">
            {headlineMetrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-border bg-background px-3 py-2.5">
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{metric.label}</p>
                <p className="mt-1 truncate text-[15px] font-black text-foreground">{String(metric.value || 'N/A')}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {breakdown.pillarCards.map((card) => {
            const Icon = PILLAR_ICONS[card.key];
            const tone = PILLAR_TONES[card.key];
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => onOpenPillar(card.key)}
                className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-gc-orange/50 hover:bg-gc-orange/5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${tone}18`, color: tone }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{card.label}</span>
                </div>
                <p className="truncate font-condensed text-[24px] font-black leading-none">{card.value}</p>
                <p className="mt-2 min-h-[28px] text-[10.5px] font-bold leading-snug text-muted-foreground">{card.insight}</p>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          {breakdown.detailSections.map((section) => (
            <div key={section.key} className="rounded-lg border border-border bg-background">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h3 className="font-condensed text-[16px] font-extrabold uppercase tracking-tight">{section.label}</h3>
                  <p className="text-[11px] font-semibold text-muted-foreground">{section.rows.length} employee-linked rows</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onOpenPillar(section.key)}>
                  Open Pillar
                </Button>
              </div>
              <MiniRowsTable rows={section.rows.slice(0, 6)} emptyText={`No ${section.label.toLowerCase()} for this employee.`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniRowsTable({ rows, emptyText }: { rows: AnalysisDataRow[]; emptyText: string }) {
  if (!rows.length) {
    return <div className="p-4"><EmptyState text={emptyText} /></div>;
  }

  const columns = Object.keys(rows[0]).slice(0, 5);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-secondary/40">
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column} className="py-2 text-[9.5px] font-extrabold uppercase tracking-widest text-muted-foreground">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index} className="border-border hover:bg-secondary/30">
              {columns.map((column) => (
                <TableCell key={`${index}-${column}`} className="max-w-[220px] truncate text-[11.5px] font-medium">
                  {String(row[column] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      <select
        className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-[12px] font-semibold text-foreground outline-none transition-colors focus:border-gc-orange focus:ring-2 focus:ring-gc-orange/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-right text-[12px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm font-medium text-muted-foreground">
      {text}
    </div>
  );
}
