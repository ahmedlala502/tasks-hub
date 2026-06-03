# Full Analysis Hub Design

## Decision

Upgrade the existing `/reporting` page into the primary Full Analysis Hub. The route stays the same so current navigation, access control, exports, and report links keep working, but the page becomes a richer filtered analysis surface instead of a mostly export-oriented reporting view.

## Goals

- Provide one command page for analysis by employee, task, campaign, handover, blocker, SLA, team, and office.
- Keep the existing role-aware workspace data filtering and report visibility rules.
- Let users narrow the page with practical filters: pillar, employee, team, office, campaign, status, priority, and text search.
- Show both executive summaries and detailed rows for the selected pillar.
- Preserve current XLSX, CSV, and full workbook export workflows, aligned with the active filtered report where appropriate.

## Page Structure

The page header changes from "Reporting Center / Pillar Analytics Hub" to a stronger "Full Analysis Hub" positioning. The top area shows global KPI cards for the main operational objects: employees, tasks, campaigns, handovers, blockers, SLA, teams, and offices.

Below the header, a compact filter bar gives users direct control over the analysis scope. Filters should be dense, scan-friendly, and consistent with the existing app style. The filter bar includes:

- Pillar selector
- Employee / agent selector
- Team selector
- Office selector
- Campaign selector
- Status selector
- Priority selector
- Search input
- Reset filters action

The pillar section remains card/tab based, but each pillar should clearly communicate the count, signal, and current filtered impact. The selected pillar drives the deep-dive panel.

## Pillars

The upgraded page covers these pillars:

- Employees: per-person workload, completed work, pending work, handovers, blockers, campaigns, productivity score, and completion rate.
- Tasks: owner, campaign, priority, status, due pressure, age, and completion state.
- Campaigns: owner, market, status, health, budget, target coverage, platform mix, and related workload signal.
- Handovers: from lead, to lead, team, region, status, linked tasks, and note depth.
- Blockers: owner, campaign, severity, status, impact, and age.
- SLA: owner-level due-soon, overdue, completed, and compliance rate.
- Teams: team workload, agents, offices, tasks, completed, pending, handovers, blockers, campaigns, and productivity.
- Offices: office-level staffing, role mix, workload, completion, handovers, blockers, campaigns, and SLA posture.

## Data Flow

The page continues using `dataService` as the workspace source and keeps the existing role filters from `workspace.ts`. It also reuses current directory sources for employees: default access users, attached export users, cloud users for masters, current user, and observed names from workspace records.

Analysis rows should be derived in `useMemo` from filtered workspace data. The filters apply consistently before chart, insight cards, table rows, and exports where possible. When a filter is not relevant to a pillar, it should be ignored without breaking the page.

## Interaction

Selecting a pillar updates the URL query parameter so existing links continue to work. Office filtering for the offices pillar should keep the existing `office` query behavior.

Users can combine filters. For example:

- Employee + Tasks shows that employee's task rows.
- Campaign + Handovers shows handovers linked to that campaign where task linkage allows it.
- Status + Campaigns shows campaign rows by operational status.
- Priority + Tasks or SLA focuses on pressure points.

The table remains the source of truth for detailed rows. Charts and insight text summarize the currently filtered table.

## Empty And Edge States

If filters produce no rows, show a clear empty state in the deep-dive area and keep export buttons disabled or harmless. Missing owner, campaign, office, or team values should be grouped as "Unassigned" or "N/A" consistently.

## Testing

Verification should include:

- TypeScript build or lint.
- Existing report-related tests if available.
- Browser check of `/reporting` on desktop and mobile widths.
- Manual checks for pillar switching, combined filters, reset filters, exports, and role-safe data rendering.

## Out Of Scope

- Creating a new route.
- Changing the underlying storage model.
- Adding backend aggregation endpoints.
- Removing the existing `/analytics` page.
