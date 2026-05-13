import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CheckSquare,
  Clock3,
  Download,
  FileSpreadsheet,
  FolderKanban,
  Handshake,
  Search,
  ShieldAlert,
  Users2,
  Workflow,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
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
import { useAuth } from '../App';
import {
  filterBlockersByRole,
  filterCampaignsByRole,
  filterHandoversByRole,
  filterTasksByRole,
} from '../lib/workspace';
import { INITIAL_MEMBERS, OFFICES, TEAMS } from '../../constants';
import { DEFAULT_ACCESS_USERS } from '../auth/defaultAccessUsers';
import { getOfficeFromProfile, OPS_OFFICES, type OpsOffice, type OpsRole, type OpsUser } from '../auth/types';
import { buildOfficeInsights, type OfficeUser } from '../lib/officeInsights';
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

type PillarKey =
  | 'offices'
  | 'teams'
  | 'agents'
  | 'tasks'
  | 'handovers'
  | 'sla'
  | 'blockers'
  | 'campaigns';

type DataRow = Record<string, string | number>;

type PillarReport = {
  key: PillarKey;
  label: string;
  description: string;
  value: string;
  insight: string;
  rows: DataRow[];
  detailRows?: DataRow[];
};

const PILLAR_META: Array<{
  key: PillarKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = [
  { key: 'offices', label: 'Offices', description: 'Regional command coverage and load distribution.', icon: Building2, tone: '#f97316' },
  { key: 'teams', label: 'Teams', description: 'Execution quality and team productivity.', icon: Workflow, tone: '#f59e0b' },
  { key: 'agents', label: 'Agents', description: 'Individual throughput and ownership depth.', icon: Users2, tone: '#8b5cf6' },
  { key: 'tasks', label: 'Tasks', description: 'Task flow, completion, and pending backlog.', icon: CheckSquare, tone: '#14b8a6' },
  { key: 'handovers', label: 'Handovers', description: 'Shift relay health and acknowledgement quality.', icon: Handshake, tone: '#6366f1' },
  { key: 'sla', label: 'SLA', description: 'On-time delivery, due-soon, and overdue pressure.', icon: Clock3, tone: '#22c55e' },
  { key: 'blockers', label: 'Blockers', description: 'Risk concentration by owner and severity.', icon: ShieldAlert, tone: '#ef4444' },
  { key: 'campaigns', label: 'Campaigns', description: 'Portfolio health, budget, and ownership.', icon: FolderKanban, tone: '#0ea5e9' },
];

const CHART_COLORS = ['#f97316', '#f59e0b', '#8b5cf6', '#14b8a6', '#6366f1', '#22c55e', '#ef4444', '#0ea5e9'];
const PILLAR_KEYS: PillarKey[] = ['offices', 'teams', 'agents', 'tasks', 'handovers', 'sla', 'blockers', 'campaigns'];

function normalize(value: string | undefined | null) {
  return (value || '').trim();
}

function toTitle(text: string) {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function currency(value: number) {
  return `$${value.toLocaleString()}`;
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function isOverdue(dueDate: number | undefined, completed: boolean) {
  return !completed && typeof dueDate === 'number' && dueDate < Date.now();
}

function isDueSoon(dueDate: number | undefined, completed: boolean) {
  if (completed || typeof dueDate !== 'number') return false;
  const diff = dueDate - Date.now();
  return diff >= 0 && diff <= 1000 * 60 * 60 * 24;
}

function formatDueDate(dueDate: number | undefined) {
  if (!dueDate) return 'N/A';
  return new Date(dueDate).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildRowsMap<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = normalize(getKey(item)) || 'Unassigned';
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {});
}

function isPillarKey(value: unknown): value is PillarKey {
  return PILLAR_KEYS.includes(value as PillarKey);
}

function normalizeLower(value: string | undefined | null) {
  return normalize(value).toLowerCase();
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

export default function Reporting() {
  const { role, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPillar, setSelectedPillar] = useState<PillarKey>('campaigns');
  const [selectedOffice, setSelectedOffice] = useState<'all' | OpsOffice>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cloudUsers, setCloudUsers] = useState<OpsUser[]>([]);
  const [, setRefreshNonce] = useState(0);

  useEffect(() => {
    const pillarParam = searchParams.get('pillar');
    const officeParam = searchParams.get('office');
    if (isPillarKey(pillarParam)) setSelectedPillar(pillarParam);
    if (OPS_OFFICES.includes(officeParam as OpsOffice)) setSelectedOffice(officeParam as OpsOffice);
    else setSelectedOffice('all');
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
    const refresh = () => setRefreshNonce((value) => value + 1);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const reports = useMemo(() => {
    const tasks = filterTasksByRole(role, dataService.getTasks());
    const handovers = filterHandoversByRole(role, dataService.getHandovers());
    const blockers = filterBlockersByRole(role, dataService.getBlockers());
    const campaigns = filterCampaignsByRole(role, dataService.getCampaigns());

    const directoryFromMembers = INITIAL_MEMBERS.map((member) => ({
      name: member.name,
      team: member.team,
      office: member.office,
      country: member.country,
      role: member.role,
      status: member.status,
    }));

    const observedNames = new Set<string>();
    tasks.forEach((task) => observedNames.add(normalize(task.ownerId)));
    handovers.forEach((handover) => {
      observedNames.add(normalize(handover.outgoingLead));
      observedNames.add(normalize(handover.incomingLead));
    });
    blockers.forEach((blocker) => observedNames.add(normalize(blocker.ownerId)));
    campaigns.forEach((campaign) => {
      observedNames.add(normalize(campaign.currentOwner));
      campaign.internalOwners.forEach((owner) => observedNames.add(normalize(owner)));
    });

    const memberMap = new Map(directoryFromMembers.map((member) => [normalizeLower(member.name), member]));
    const directoryUsers: OfficeUser[] = [
      ...DEFAULT_ACCESS_USERS.map((item) => ({
        uid: `seed-${item.email}`,
        email: item.email,
        displayName: item.name,
        role: item.role,
        status: 'active' as const,
        office: item.office,
        department: item.department,
        title: item.title,
        timezone: 'Africa/Cairo',
      })),
      ...ATTACHED_EXPORT_USERS,
      ...cloudUsers,
      ...(user ? [user] : []),
      ...Array.from(observedNames).filter(Boolean).map((name) => {
        const member = memberMap.get(normalizeLower(name));
        const inferredRole = roleFromObservedName(name);
        return {
          uid: `observed-${normalizeLower(name)}`,
          email: '',
          displayName: name,
          role: inferredRole,
          status: 'active' as const,
          office: getOfficeFromProfile({ name, role: inferredRole, office: member?.office }),
          department: member?.team || (inferredRole === 'community' ? 'Coordination' : 'Operations'),
          title: member?.role || 'Workspace Owner',
          timezone: 'Africa/Cairo',
        };
      }),
    ];

    const officeInsights = buildOfficeInsights({
      users: uniqueOfficeUsers(directoryUsers),
      tasks,
      handovers,
      blockers,
      campaigns,
    });

    const agents = officeInsights.agentRows
      .map((row) => ({
        name: row.name,
        team: row.department || (row.role === 'community' ? 'Community Team' : 'Operations Team'),
        office: row.office,
        country: OFFICES.find((office) => office.name === row.office)?.country || row.office,
        role: row.title || row.role,
        status: 'active',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const tasksByOwner = buildRowsMap(tasks, (task) => task.ownerId);
    const blockersByOwner = buildRowsMap(blockers, (blocker) => blocker.ownerId);
    const handoversByOutgoing = buildRowsMap(handovers, (handover) => handover.outgoingLead);
    const campaignsByOwner = buildRowsMap(campaigns, (campaign) => campaign.currentOwner);

    const officeRows: DataRow[] = officeInsights.officeRows.map((row) => ({
      Office: row.office,
      Country: OFFICES.find((office) => office.name === row.office)?.country || row.office,
      Agents: row.agents,
      Community: row.communityAgents,
      Operations: row.operationsAgents,
      Tasks: row.tasks,
      Completed: row.done,
      Pending: row.pending,
      Handovers: row.handovers,
      Blockers: row.blockers,
      Campaigns: row.campaigns,
      SLA: `${row.completionRate}%`,
    }));

    const officeAgentRows: DataRow[] = officeInsights.agentRows
      .filter((row) => selectedOffice === 'all' || row.office === selectedOffice)
      .map((row) => ({
        Agent: row.name,
        Email: row.email || 'N/A',
        Office: row.office,
        Role: row.role,
        Team: row.department,
        Title: row.title,
        Tasks: row.tasks,
        Done: row.done,
        Pending: row.pending,
        Handovers: row.handovers,
        Blockers: row.blockers,
        Campaigns: row.campaigns,
        Rate: `${row.completionRate}%`,
      }));

    const teamRows: DataRow[] = TEAMS.map((team) => {
      const teamAgents = agents.filter((agent) => agent.team === team);
      const teamNames = new Set(teamAgents.map((agent) => agent.name));
      const teamTasks = tasks.filter((task) => teamNames.has(normalize(task.ownerId)));
      const teamDone = teamTasks.filter((task) => task.completed).length;
      const teamHandovers = handovers.filter(
        (handover) =>
          teamNames.has(normalize(handover.outgoingLead)) ||
          teamNames.has(normalize(handover.incomingLead)) ||
          normalize(handover.team) === team.replace(' Team', ''),
      );
      const teamBlockers = blockers.filter((blocker) => teamNames.has(normalize(blocker.ownerId)));
      const teamCampaigns = campaigns.filter((campaign) => teamNames.has(normalize(campaign.currentOwner)));

      return {
        Team: team,
        Agents: teamAgents.length,
        Offices: new Set(teamAgents.map((agent) => agent.office)).size,
        Tasks: teamTasks.length,
        Completed: teamDone,
        Pending: teamTasks.length - teamDone,
        Handovers: teamHandovers.length,
        Blockers: teamBlockers.length,
        Campaigns: teamCampaigns.length,
        Productivity: percent(teamTasks.length ? (teamDone / teamTasks.length) * 100 : 0),
      };
    }).filter((row) => Number(row.Agents) > 0 || Number(row.Tasks) > 0);

    const agentRows: DataRow[] = agents.map((agent) => {
      const agentTasks = tasksByOwner[agent.name] || [];
      const done = agentTasks.filter((task) => task.completed).length;
      const pending = agentTasks.length - done;
      const agentHandoversOut = handoversByOutgoing[agent.name] || [];
      const agentHandoversIn = handovers.filter((handover) => normalize(handover.incomingLead) === agent.name);
      const agentBlockers = blockersByOwner[agent.name] || [];
      const agentCampaigns = campaignsByOwner[agent.name] || [];
      const productivityScore = done * 10 + agentHandoversOut.length * 5 - agentBlockers.length * 4;

      return {
        Agent: agent.name,
        Team: agent.team,
        Office: agent.office,
        Role: agent.role,
        Tasks: agentTasks.length,
        Done: done,
        Pending: pending,
        HandoversOut: agentHandoversOut.length,
        HandoversIn: agentHandoversIn.length,
        Blockers: agentBlockers.length,
        Campaigns: agentCampaigns.length,
        Score: productivityScore,
      };
    }).filter((row) => Number(row.Tasks) > 0 || Number(row.HandoversOut) > 0 || Number(row.Campaigns) > 0);

    const taskRows: DataRow[] = tasks.map((task) => ({
      Task: task.title,
      Owner: normalize(task.ownerId),
      Campaign: normalize(task.campaignId),
      Priority: task.priority,
      Status: task.completed ? 'Completed' : isOverdue(task.dueDate, task.completed) ? 'Overdue' : isDueSoon(task.dueDate, task.completed) ? 'Due Soon' : 'Open',
      DueDate: formatDueDate(task.dueDate),
      AgeDays: Math.max(0, Math.floor((Date.now() - task.createdAt) / (1000 * 60 * 60 * 24))),
    }));

    const handoverRows: DataRow[] = handovers.map((handover) => ({
      Date: handover.handoffDate,
      Team: handover.team,
      Region: handover.region,
      From: handover.outgoingLead,
      To: handover.incomingLead,
      Status: handover.status,
      LinkedTasks: handover.taskIds.length,
      NotesSize: handover.notes.length,
    }));

    const blockerRows: DataRow[] = blockers.map((blocker) => ({
      Blocker: blocker.summary,
      Owner: normalize(blocker.ownerId),
      Severity: blocker.severity,
      Status: blocker.status,
      Campaign: normalize(blocker.campaignId),
      AgeDays: Math.max(0, Math.floor((Date.now() - blocker.createdAt) / (1000 * 60 * 60 * 24))),
      Impact: blocker.impact,
    }));

    const campaignRows: DataRow[] = campaigns.map((campaign) => ({
      Campaign: campaign.name,
      Owner: campaign.currentOwner,
      Market: `${campaign.country} / ${campaign.city}`,
      Status: campaign.status,
      Health: campaign.recordHealth,
      Budget: campaign.budget,
      Targets: campaign.targetInfluencers,
      CoverageTarget: campaign.targetPostingCoverage,
      Platforms: campaign.platforms.join(', '),
    }));

    const slaOwnerRows: DataRow[] = agents.map((agent) => {
      const agentTasks = tasksByOwner[agent.name] || [];
      const total = agentTasks.length;
      const completed = agentTasks.filter((task) => task.completed).length;
      const overdue = agentTasks.filter((task) => isOverdue(task.dueDate, task.completed)).length;
      const dueSoon = agentTasks.filter((task) => isDueSoon(task.dueDate, task.completed)).length;
      const complianceRate = total ? ((total - overdue) / total) * 100 : 100;

      return {
        Owner: agent.name,
        Team: agent.team,
        TotalTasks: total,
        Completed: completed,
        DueSoon: dueSoon,
        Overdue: overdue,
        Compliance: percent(complianceRate),
      };
    }).filter((row) => Number(row.TotalTasks) > 0);

    const doneTasks = tasks.filter((task) => task.completed).length;
    const overdueTasks = tasks.filter((task) => isOverdue(task.dueDate, task.completed)).length;
    const acknowledgedHandovers = handovers.filter((handover) => handover.status !== 'Pending').length;
    const totalBudget = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);

    const reportMap: Record<PillarKey, PillarReport> = {
      offices: {
        key: 'offices',
        label: 'Offices',
        description: selectedOffice === 'all'
          ? 'Regional office throughput, staffing spread, and SLA posture.'
          : `${selectedOffice} office agent-by-agent performance breakdown.`,
        value: selectedOffice === 'all'
          ? String(officeRows.length)
          : String(officeAgentRows.length),
        insight: selectedOffice === 'all'
          ? `${officeRows.reduce((sum, row) => sum + Number(row.Tasks || 0), 0)} tracked tasks across all active offices`
          : `${officeAgentRows.reduce((sum, row) => sum + Number(row.Done || 0), 0)} completed tasks inside ${selectedOffice}`,
        rows: officeRows,
        detailRows: officeAgentRows,
      },
      teams: {
        key: 'teams',
        label: 'Teams',
        description: 'Team-level execution, load, and backlog visibility.',
        value: String(teamRows.length),
        insight: `${teamRows.reduce((sum, row) => sum + Number(row.Completed || 0), 0)} completed tasks delivered by active teams`,
        rows: teamRows,
      },
      agents: {
        key: 'agents',
        label: 'Agents',
        description: 'Individual productivity, ownership, and handover responsibility.',
        value: String(agentRows.length),
        insight: `${agentRows.filter((row) => Number(row.Score || 0) > 0).length} agents currently driving positive output`,
        rows: agentRows,
      },
      tasks: {
        key: 'tasks',
        label: 'Tasks',
        description: 'Detailed task flow with owner, status, and due-date pressure.',
        value: String(tasks.length),
        insight: `${doneTasks} done / ${tasks.length - doneTasks} still open`,
        rows: taskRows,
      },
      handovers: {
        key: 'handovers',
        label: 'Handovers',
        description: 'Shift relay continuity, acknowledgement, and linked workload.',
        value: String(handovers.length),
        insight: `${acknowledgedHandovers} acknowledged or reviewed relays`,
        rows: handoverRows,
      },
      sla: {
        key: 'sla',
        label: 'SLA',
        description: 'Compliance pressure by owner using due dates and backlog heat.',
        value: percent(tasks.length ? ((tasks.length - overdueTasks) / tasks.length) * 100 : 100),
        insight: `${overdueTasks} overdue tasks currently threatening SLA`,
        rows: slaOwnerRows,
      },
      blockers: {
        key: 'blockers',
        label: 'Blockers',
        description: 'Open risk inventory with severity, age, and ownership.',
        value: String(blockers.length),
        insight: `${blockers.filter((blocker) => blocker.severity === 'Critical').length} critical blockers require immediate attention`,
        rows: blockerRows,
      },
      campaigns: {
        key: 'campaigns',
        label: 'Campaigns',
        description: 'Portfolio health, ownership mix, and budget exposure.',
        value: String(campaigns.length),
        insight: `${currency(totalBudget)} in tracked campaign budget`,
        rows: campaignRows,
      },
    };

    return reportMap;
  }, [cloudUsers, role, selectedOffice, user]);

  const selectedReport = reports[selectedPillar];
  const activeReportRows = selectedPillar === 'offices' && selectedOffice !== 'all'
    ? selectedReport.detailRows || selectedReport.rows
    : selectedReport.rows;
  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return activeReportRows;
    return activeReportRows.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [activeReportRows, searchTerm]);

  const chart = useMemo(() => {
    const rows = filteredRows.slice(0, 6);
    if (!rows.length) return { labelKey: '', valueKey: '', rows: [] as Array<Record<string, string | number>> };

    const firstRow = rows[0];
    const keys = Object.keys(firstRow);
    const labelKey = keys.find((key) => typeof firstRow[key] === 'string') || keys[0];
    const valueKey = keys.find((key) => typeof firstRow[key] === 'number') || keys[1] || keys[0];

    return { labelKey, valueKey, rows };
  }, [filteredRows]);

  const tableColumns = filteredRows[0] ? Object.keys(filteredRows[0]) : [];
  const officeSummaryRows = reports.offices.rows;
  const allOfficeTotals = officeSummaryRows.reduce<{ agents: number; tasks: number; done: number }>((acc, row) => ({
    agents: acc.agents + Number(row.Agents || 0),
    tasks: acc.tasks + Number(row.Tasks || 0),
    done: acc.done + Number(row.Completed || 0),
  }), { agents: 0, tasks: 0, done: 0 });
  const globalSheets = Object.values(reports).map((report) => ({
    name: toTitle(report.label),
    rows: report.key === 'offices' && report.detailRows ? [...report.rows, ...report.detailRows] : report.rows,
  }));

  const exportCurrentXlsx = () => exportRows(`trygc_${selectedPillar}_report.xlsx`, selectedReport.rows);
  const exportCurrentCsv = () => exportRowsAsCsv(`trygc_${selectedPillar}_report.csv`, selectedReport.rows);
  const exportAllWorkbook = () => exportWorkbook('trygc_reporting_hub.xlsx', globalSheets);

  const totalTasks = Number(reports.tasks.value || 0);
  const totalHandovers = Number(reports.handovers.value || 0);
  const totalBlockers = Number(reports.blockers.value || 0);
  const totalCampaigns = Number(reports.campaigns.value || 0);

  const choosePillar = (pillar: PillarKey) => {
    setSelectedPillar(pillar);
    const next = new URLSearchParams(searchParams);
    next.set('pillar', pillar);
    if (pillar !== 'offices') next.delete('office');
    setSearchParams(next);
  };

  const chooseOffice = (office: 'all' | OpsOffice) => {
    setSelectedPillar('offices');
    setSelectedOffice(office);
    const next = new URLSearchParams(searchParams);
    next.set('pillar', 'offices');
    if (office === 'all') next.delete('office');
    else next.set('office', office);
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gc-orange">Reporting Center</p>
          <h1 className="font-condensed text-[28px] font-extrabold uppercase tracking-tight">Pillar Analytics Hub</h1>
          <p className="mt-1 max-w-3xl text-[12px] font-medium text-muted-foreground">
            Drill into every operational pillar, click across live metrics, and export both Excel and CSV reports from the same command surface.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={exportAllWorkbook} className="h-10 bg-gc-orange text-white hover:bg-gc-orange/90">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Full Workbook
          </Button>
          <Button variant="outline" onClick={exportCurrentXlsx} className="h-10">
            <Download className="mr-2 h-4 w-4" />
            Export {selectedReport.label} XLSX
          </Button>
          <Button variant="outline" onClick={exportCurrentCsv} className="h-10">
            <Download className="mr-2 h-4 w-4" />
            Export {selectedReport.label} CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Tasks Tracked" value={String(totalTasks)} tone="text-gc-orange" />
        <SummaryCard label="Handovers Live" value={String(totalHandovers)} tone="text-indigo-500" />
        <SummaryCard label="Open Blockers" value={String(totalBlockers)} tone="text-red-500" />
        <SummaryCard label="Campaigns Active" value={String(totalCampaigns)} tone="text-sky-500" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PILLAR_META.map((pillar) => {
          const report = reports[pillar.key];
          const Icon = pillar.icon;
          const isActive = selectedPillar === pillar.key;

          return (
            <button
              key={pillar.key}
              onClick={() => choosePillar(pillar.key)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                isActive
                  ? 'border-gc-orange bg-gc-orange/8 shadow-[0_0_0_1px_rgba(249,115,22,0.15)]'
                  : 'border-border bg-card hover:border-gc-orange/40 hover:bg-secondary/30'
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${pillar.tone}18`, color: pillar.tone }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  Click
                </Badge>
              </div>
              <div>
                <p className="font-condensed text-[18px] font-extrabold uppercase tracking-tight">{report.label}</p>
                <p className="mt-1 text-[12px] font-semibold text-muted-foreground">{report.description}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <span className="font-condensed text-[28px] font-black leading-none">{report.value}</span>
                  <span className="text-right text-[11px] font-bold text-muted-foreground">{report.insight}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPillar === 'offices' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <OfficeFilterCard
            active={selectedOffice === 'all'}
            label="All Offices"
            value={String(allOfficeTotals.agents)}
            detail={`${allOfficeTotals.tasks} tasks / ${allOfficeTotals.done} done`}
            onClick={() => chooseOffice('all')}
          />
          {officeSummaryRows.map((row) => (
            <OfficeFilterCard
              key={String(row.Office)}
              active={selectedOffice === row.Office}
              label={String(row.Office)}
              value={String(row.Agents)}
              detail={`${row.Tasks} tasks / ${row.Completed} done`}
              onClick={() => chooseOffice(row.Office as OpsOffice)}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-condensed text-[18px] font-extrabold uppercase tracking-tight">
              <BarChart3 className="h-4 w-4 text-gc-orange" />
              {selectedReport.label} Performance Spread
            </CardTitle>
            <CardDescription>{selectedReport.description}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chart.rows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey={chart.labelKey}
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey={chart.valueKey} radius={[8, 8, 0, 0]}>
                    {chart.rows.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No chartable data available for this pillar yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="font-condensed text-[18px] font-extrabold uppercase tracking-tight">
              {selectedReport.label} Intelligence
            </CardTitle>
            <CardDescription>Fast operational reading for the currently selected reporting pillar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InsightRow label="Selected Pillar" value={selectedReport.label} />
            <InsightRow label="Rows Available" value={String(selectedReport.rows.length)} />
            <InsightRow label="Filtered Rows" value={String(filteredRows.length)} />
            <InsightRow label="Key Insight" value={selectedReport.insight} />
            <InsightRow label="Export Modes" value="XLSX + CSV" />
            <div className="rounded-xl border border-dashed border-gc-orange/30 bg-gc-orange/5 p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-gc-orange">Analysis Note</p>
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-muted-foreground">
                Click any pillar card to reframe the report instantly. Each pillar now has its own table, chart, and dedicated export path.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="font-condensed text-[20px] font-extrabold uppercase tracking-tight">
              {selectedReport.label} Detailed Analysis
            </CardTitle>
            <CardDescription>
              {selectedPillar === 'offices' && selectedOffice !== 'all'
                ? `Showing every person in ${selectedOffice} with workload, handovers, blockers, and campaign ownership.`
                : 'Search, click through, and export the exact rows behind the selected pillar.'}
            </CardDescription>
          </div>

          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={`Search ${selectedReport.label.toLowerCase()} report...`}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredRows.length ? (
            <div className="overflow-x-auto rounded-xl border border-border">
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
                  {filteredRows.map((row, index) => (
                    <TableRow key={`${selectedPillar}-${index}`} className="border-border hover:bg-secondary/30">
                      {tableColumns.map((column) => (
                        <TableCell key={`${selectedPillar}-${index}-${column}`} className="text-[12px] font-medium">
                          {String(row[column])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              No matching rows found for this search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={`mt-2 font-condensed text-[30px] font-black leading-none ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function OfficeFilterCard({ active, label, value, detail, onClick }: { active: boolean; label: string; value: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all ${
        active ? 'border-gc-orange bg-gc-orange/8 shadow-[0_0_0_1px_rgba(249,115,22,0.14)]' : 'border-border bg-card hover:border-gc-orange/40'
      }`}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-condensed text-[26px] font-black leading-none text-foreground">{value}</p>
      <p className="mt-2 text-[11px] font-bold text-muted-foreground">{detail}</p>
    </button>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background px-3 py-2.5">
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-right text-[12px] font-semibold text-foreground">{value}</span>
    </div>
  );
}
