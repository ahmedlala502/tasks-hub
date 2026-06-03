# Full Analysis Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/reporting` into the Full Analysis Hub with global filters, per-pillar deep dives, and exports for every pillar.

**Architecture:** Extract report aggregation and filter behavior into `src/ops/lib/fullAnalysisHub.ts` so the page can stay focused on UI and export actions. `src/ops/pages/Reporting.tsx` will build the directory/user inputs, call the library, render the filter bar and pillar views, and export the filtered rows plus a workbook containing every pillar.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Recharts, existing shadcn-style UI primitives, existing spreadsheet export service.

---

### Task 1: Analysis Model And Filter Tests

**Files:**
- Create: `src/ops/lib/fullAnalysisHub.test.ts`
- Create: `src/ops/lib/fullAnalysisHub.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ops/lib/fullAnalysisHub.test.ts` with fixtures for two employees, tasks, one campaign, handovers, and blockers. Add tests that call `buildFullAnalysisHub()` with filters and assert:

```ts
expect(result.reports.tasks.filteredRows).toHaveLength(1);
expect(result.reports.tasks.filteredRows[0]).toMatchObject({ Owner: 'Mona', Campaign: 'Launch A' });
expect(result.reports.campaigns.filteredRows).toHaveLength(1);
expect(result.exportSheets.map((sheet) => sheet.name)).toEqual([
  'Employees',
  'Tasks',
  'Campaigns',
  'Handovers',
  'Blockers',
  'SLA',
  'Teams',
  'Offices',
]);
expect(result.exportSheets.every((sheet) => Array.isArray(sheet.rows))).toBe(true);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ops/lib/fullAnalysisHub.test.ts`

Expected: fail because `fullAnalysisHub.ts` does not exist.

- [ ] **Step 3: Implement the minimal analysis library**

Create `src/ops/lib/fullAnalysisHub.ts` exporting:

```ts
export type AnalysisPillarKey = 'employees' | 'tasks' | 'campaigns' | 'handovers' | 'blockers' | 'sla' | 'teams' | 'offices';
export type AnalysisFilters = {
  pillar: AnalysisPillarKey;
  employee: string;
  team: string;
  office: 'all' | OpsOffice;
  campaign: string;
  status: string;
  priority: string;
  search: string;
};
export type AnalysisDataRow = Record<string, string | number>;
export type AnalysisReport = {
  key: AnalysisPillarKey;
  label: string;
  description: string;
  value: string;
  insight: string;
  rows: AnalysisDataRow[];
  filteredRows: AnalysisDataRow[];
};
export function buildFullAnalysisHub(input: FullAnalysisInput): FullAnalysisResult;
export function defaultAnalysisFilters(pillar?: AnalysisPillarKey): AnalysisFilters;
```

The implementation should build rows for employees, tasks, campaigns, handovers, blockers, SLA, teams, and offices, then apply relevant filters to each pillar. It should return `exportSheets` with all eight pillars and rows set to each pillar's filtered rows.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ops/lib/fullAnalysisHub.test.ts`

Expected: pass.

### Task 2: Upgrade Reporting Page UI

**Files:**
- Modify: `src/ops/pages/Reporting.tsx`

- [ ] **Step 1: Replace local report aggregation with the library**

Import `buildFullAnalysisHub`, `defaultAnalysisFilters`, and `AnalysisPillarKey`. Keep the existing directory-building logic for default users, attached users, cloud users, current user, and observed names. Pass filtered workspace records and directory users into `buildFullAnalysisHub()`.

- [ ] **Step 2: Add the global filter bar**

Add compact controls for pillar, employee, team, office, campaign, status, priority, search, and reset. Use native `select` controls or existing select primitives with the current app styling. Update URL query params for `pillar` and `office` so existing links keep working.

- [ ] **Step 3: Render the Full Analysis Hub surface**

Rename the page header to `Full Analysis Hub`. Render global KPI cards, pillar cards for all eight pillars, chart and intelligence cards for the selected pillar, and a detailed table based on `selectedReport.filteredRows`.

- [ ] **Step 4: Ensure exports use filtered rows**

Wire export buttons as:

```ts
exportRows(`trygc_${selectedPillar}_analysis.xlsx`, selectedReport.filteredRows);
exportRowsAsCsv(`trygc_${selectedPillar}_analysis.csv`, selectedReport.filteredRows);
exportWorkbook('trygc_full_analysis_hub.xlsx', analysis.exportSheets);
```

This ensures all pillars can be exported, and the current pillar export matches active filters.

### Task 3: Verify And Polish

**Files:**
- Modify if needed: `src/ops/pages/Reporting.tsx`
- Modify if needed: `src/ops/lib/fullAnalysisHub.ts`

- [ ] **Step 1: Run type and test verification**

Run:

```bash
npm run lint
npx vitest run src/ops/lib/fullAnalysisHub.test.ts
```

Expected: both commands pass.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

Expected: Vite serves the app on `http://localhost:3000` or another available port.

- [ ] **Step 3: Browser check**

Open `/reporting`, verify the page loads, filters combine correctly, pillar switching updates the deep-dive table, reset restores all filters, and export buttons are visible for workbook, XLSX, and CSV.

- [ ] **Step 4: Final review**

Confirm there is no duplicated `/analysis` route, no storage model changes, no broken existing `/reporting?pillar=...` links, and no unrelated worktree changes included.
