/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CampaignStage } from '../constants';
import { Campaign, CampaignInfluencer, Task } from '../types';

export interface UserImportRow {
  email: string;
  name: string;
  password: string;
  role: 'master' | 'operations' | 'community';
  office?: 'Egypt' | 'KSA' | 'UAE' | 'Kuwait';
  department?: string;
  title?: string;
}

type Row = Record<string, any>;

const now = () => Date.now();
const text = (value: any, fallback = '') => String(value ?? fallback).trim();
const num = (value: any, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (value: any) => ['true', 'yes', '1', 'y'].includes(String(value ?? '').toLowerCase());
const list = (value: any) => text(value).split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
const asDateText = (value: any, fallback = new Date().toISOString().slice(0, 10)) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = text(value);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : raw;
};

function pick(row: Row, keys: string[], fallback = '') {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), value]));
  for (const key of keys) {
    const value = normalized[key.toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
}

export async function readSpreadsheet(file: File): Promise<Row[]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseCsv(await file.text());
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = text(cell.value);
  });

  const rows: Row[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Row = {};
    headers.forEach((header, index) => {
      record[header || `column_${index + 1}`] = cellToValue(row.getCell(index + 1).value);
    });
    if (Object.values(record).some((value) => text(value))) rows.push(record);
  });
  return rows;
}

export function rowsToCampaigns(rows: Row[]): Campaign[] {
  return rows.map((row, index) => {
    const id = text(pick(row, ['id', 'campaign id', 'reference']), `C-BULK-${now()}-${index + 1}`);
    const totalList = num(pick(row, ['total list', 'list size', 'total influencers']), 0);
    const confirmations = num(pick(row, ['confirmations', 'confirmation']), 0);
    const target = num(pick(row, ['target', 'targetInfluencers', 'target influencers']), 0);
    const visited = num(pick(row, ['visited', 'visits']), 0);
    const coverage = num(pick(row, ['coverage', 'covered']), 0);
    const approved = num(pick(row, ['approved', 'approval']), 0);
    const rejected = num(pick(row, ['reject', 'rejected']), 0);
    const dailyTarget = num(pick(row, ['daily target', 'dailyTarget']), 0);
    const todaysVisits = num(pick(row, ["today's visits", 'todays visits', 'today visits', 'todayVisits']), 0);
    const tomorrowsVisits = num(pick(row, ["tomorrow's visits", 'tomorrows visits', 'tomorrow visits', 'tomorrowVisits']), 0);
    const dayAfterVisits = num(pick(row, ['day after', 'day after visits', 'dayAfterVisits']), 0);
    const runRate = num(pick(row, ['run rate', 'runRate']), 0);
    const targetRate = num(pick(row, ['% of target', 'target rate', 'target %']), 0);
    const confirmationRate = num(pick(row, ['conf rate %', 'confirmation rate', 'confirmation rate %']), 0);
    const coverageRate = num(pick(row, ['cov rate %', 'coverage rate', 'coverage rate %']), 0);
    const defaultCountry = text(pick(row, ['country', 'market']), 'KSA');
    const defaultCity = defaultCountry.toLowerCase().includes('uae')
      ? 'Dubai'
      : defaultCountry.toLowerCase().includes('kuwait')
        ? 'Kuwait City'
        : 'Riyadh';
    return {
      id,
      name: text(pick(row, ['name', 'campaign', 'campaign name']), `Imported Campaign ${index + 1}`),
      clientId: text(pick(row, ['clientId', 'client id', 'client']), 'bulk-client'),
      brandId: text(pick(row, ['brandId', 'brand id', 'brand']), 'bulk-brand'),
      country: defaultCountry,
      city: text(pick(row, ['city']), defaultCity),
      objective: text(pick(row, ['objective']), 'Imported campaign tracker'),
      platforms: list(pick(row, ['platforms', 'platform'])).length ? list(pick(row, ['platforms', 'platform'])) : ['Instagram'],
      type: text(pick(row, ['type', 'campaign type']), 'Influencer Marketing'),
      budget: num(pick(row, ['budget']), 0),
      budgetType: text(pick(row, ['budgetType', 'budget type', 'currency']), 'USD'),
      targetInfluencers: target || num(pick(row, ['targetInfluencers', 'target influencers']), 0),
      targetPostingCoverage: coverage || target || num(pick(row, ['targetPostingCoverage', 'target coverage', 'coverage target']), coverage),
      totalList,
      confirmations,
      visited,
      coverage,
      approved,
      reject: rejected,
      dailyTarget,
      todaysVisits,
      tomorrowsVisits,
      dayAfterVisits,
      runRate,
      targetRate,
      confirmationRate,
      coverageRate,
      startDate: asDateText(pick(row, ['startDate', 'start date'])),
      endDate: asDateText(pick(row, ['endDate', 'end date'])),
      deliverables: text(pick(row, ['deliverables']), `Target ${target || 0}; confirmations ${confirmations}; visits ${visited}; coverage ${coverage}; approved ${approved}; rejected ${rejected}`),
      tags: text(pick(row, ['tags', 'hashtags']), ''),
      mentions: text(pick(row, ['mentions']), ''),
      links: text(pick(row, ['links', 'url']), ''),
      visitRequired: bool(pick(row, ['visitRequired', 'visit required'])),
      productDetails: text(pick(row, ['productDetails', 'product details']), ''),
      approvalFlow: text(pick(row, ['approvalFlow', 'approval flow']), 'Standard'),
      reportingCadence: text(pick(row, ['reportingCadence', 'reporting cadence']), 'Weekly'),
      restrictions: text(pick(row, ['restrictions']), ''),
      internalOwners: list(pick(row, ['internalOwners', 'internal owners', 'owner'])) || ['Ops'],
      clientOwners: list(pick(row, ['clientOwners', 'client owners'])) || [],
      influencerCriteria: text(pick(row, ['influencerCriteria', 'criteria']), ''),
      currentOwner: text(pick(row, ['currentOwner', 'current owner', 'owner']), 'Ops'),
      nextAction: text(
        pick(row, ['nextAction', 'next action']),
        `Review tracker metrics: ${targetRate}% target, ${confirmationRate}% confirmations, ${coverageRate}% coverage`,
      ),
      stage: num(pick(row, ['stage']), CampaignStage.INTAKE) as CampaignStage,
      status: normalizeValue(pick(row, ['status']), ['Active', 'Blocked', 'Closed', 'On Hold'], 'Active'),
      recordHealth: normalizeValue(pick(row, ['recordHealth', 'health']), ['Healthy', 'At Risk', 'Critical'], 'Healthy'),
      createdAt: now(),
      updatedAt: now(),
      createdBy: 'bulk-upload',
    };
  });
}

export function rowsToInfluencers(rows: Row[]): CampaignInfluencer[] {
  return rows.map((row, index) => ({
    id: text(pick(row, ['id', 'campaign influencer id']), `CI-BULK-${now()}-${index + 1}`),
    campaignId: text(pick(row, ['campaignId', 'campaign id', 'campaign']), 'C-001'),
    influencerId: text(pick(row, ['influencerId', 'influencer id']), `INF-BULK-${index + 1}`),
    username: text(pick(row, ['username', 'handle', 'influencer']), `@imported_${index + 1}`),
    platform: text(pick(row, ['platform']), 'Instagram'),
    city: text(pick(row, ['city']), 'Riyadh'),
    country: text(pick(row, ['country', 'market']), 'KSA'),
    niche: text(pick(row, ['niche', 'pillar']), 'Lifestyle'),
    followerRange: text(pick(row, ['followerRange', 'follower range', 'followers']), '100k-500k'),
    gender: text(pick(row, ['gender']), ''),
    status: normalizeValue(pick(row, ['status']), ['Pending', 'Invited', 'Confirmed', 'Scheduled', 'Completed', 'Dropped'], 'Pending'),
    invitationWave: num(pick(row, ['invitationWave', 'wave']), 1),
    reminder1Sent: bool(pick(row, ['reminder1Sent', 'reminder 1'])),
    reminder2Sent: bool(pick(row, ['reminder2Sent', 'reminder 2'])),
    visitCompleted: bool(pick(row, ['visitCompleted', 'visit completed'])),
    coverageReceived: bool(pick(row, ['coverageReceived', 'coverage received'])),
    coverageLink: text(pick(row, ['coverageLink', 'coverage link']), ''),
    qaStatus: normalizeValue(pick(row, ['qaStatus', 'qa status']), ['Pending', 'Approved', 'Rejected', 'Fix Required'], 'Pending'),
    notes: text(pick(row, ['notes']), ''),
    ownerId: text(pick(row, ['ownerId', 'owner']), 'Ops'),
    createdAt: now(),
    updatedAt: now(),
    createdBy: 'bulk-upload',
  }));
}

export function rowsToTasks(rows: Row[]): Task[] {
  return rows.map((row, index): Task => {
    const dueRaw = text(pick(row, ['dueDate', 'due date', 'deadline']));
    const dueDate = (() => {
      if (!dueRaw) return Date.now() + 7 * 86400_000;
      const parsed = new Date(dueRaw);
      return Number.isFinite(parsed.getTime()) ? parsed.getTime() : Date.now() + 7 * 86400_000;
    })();
    return {
      id: text(pick(row, ['id', 'task id']), `T-BULK-${now()}-${index + 1}`),
      title: text(pick(row, ['title', 'task', 'name']), `Imported Task ${index + 1}`),
      description: text(pick(row, ['description', 'details']), ''),
      ownerId: text(pick(row, ['ownerId', 'owner', 'assignee']), 'Ops'),
      dueDate,
      campaignId: text(pick(row, ['campaignId', 'campaign id', 'campaign']), ''),
      priority: normalizeValue(pick(row, ['priority']), ['Low', 'Medium', 'High', 'Critical'], 'Medium'),
      completed: bool(pick(row, ['completed', 'done'])),
      status: normalizeValue<'Pending' | 'In Progress' | 'Blocked' | 'Done'>(pick(row, ['status']), ['Pending', 'In Progress', 'Blocked', 'Done'], 'Pending'),
      department: text(pick(row, ['department']), ''),
      category: text(pick(row, ['category']), ''),
      createdAt: now(),
      updatedAt: now(),
      createdBy: 'bulk-upload',
    };
  });
}

export function rowsToUsers(rows: Row[]): UserImportRow[] {
  return rows.map((row, index) => {
    const role = String(pick(row, ['role'], 'operations')).trim().toLowerCase();
    const normalizedRole: UserImportRow['role'] =
      role === 'master' || role === 'community' || role === 'operations' ? role : 'operations';
    const office = String(pick(row, ['office', 'hub'], '')).trim();
    const normalizedOffice = (['Egypt', 'KSA', 'UAE', 'Kuwait'] as const).find(
      o => o.toLowerCase() === office.toLowerCase(),
    );
    return {
      email: text(pick(row, ['email', 'username'])).toLowerCase(),
      name: text(pick(row, ['name', 'display name', 'full name']), `Imported User ${index + 1}`),
      password: text(pick(row, ['password', 'initial password']), ''),
      role: normalizedRole,
      office: normalizedOffice,
      department: text(pick(row, ['department']), '') || undefined,
      title: text(pick(row, ['title', 'job title']), '') || undefined,
    };
  });
}

export async function exportRows(filename: string, rows: Row[]) {
  try {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Export');
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(14, header.length + 2) }));
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(filename, new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  } catch (error) {
    console.error('XLSX export failed, falling back to CSV export', error);
    const csv = toCsv(rows);
    const fallbackName = filename.replace(/\.(xlsx|xls)$/i, '.csv');
    downloadBlob(fallbackName, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  }
}

export function exportRowsAsCsv(filename: string, rows: Row[]) {
  const csv = toCsv(rows);
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
}

export async function exportWorkbook(
  filename: string,
  sheets: Array<{ name: string; rows: Row[] }>
) {
  try {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    sheets.forEach((sheet) => {
      const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31) || 'Export');
      const headers = Array.from(new Set(sheet.rows.flatMap((row) => Object.keys(row))));

      worksheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: Math.max(14, header.length + 2),
      }));

      sheet.rows.forEach((row) => worksheet.addRow(row));
      worksheet.getRow(1).font = { bold: true };
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(
      filename,
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
  } catch (error) {
    console.error('Workbook export failed, falling back to first sheet CSV', error);
    const firstSheet = sheets[0];
    if (firstSheet) {
      exportRowsAsCsv(filename.replace(/\.(xlsx|xls)$/i, '.csv'), firstSheet.rows);
    }
  }
}

function parseCsv(csv: string): Row[] {
  const rows: string[][] = [];
  let current = '';
  let record: string[] = [];
  let quoted = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      record.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      record.push(current);
      rows.push(record);
      record = [];
      current = '';
    } else {
      current += char;
    }
  }
  record.push(current);
  rows.push(record);

  const headers = (rows.shift() || []).map((header) => header.trim());
  return rows
    .filter((row) => row.some((value) => value.trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, row[index] || ''])));
}

function cellToValue(value: any) {
  if (value && typeof value === 'object') {
    if ('text' in value) return value.text;
    if ('result' in value) return value.result;
    if ('richText' in value) return value.richText.map((part: any) => part.text).join('');
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return value ?? '';
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toCsv(rows: Row[]) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escapeValue = (value: any) => {
    const stringValue = String(value ?? '');
    if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
    return stringValue;
  };
  const lines = [
    headers.map(escapeValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(',')),
  ];
  return lines.join('\n');
}

export function exportCampaigns(campaigns: Campaign[]) {
  exportRows('trygc_campaigns_export.xlsx', campaigns.map((campaign) => ({
    'Campaign Name': campaign.name,
    Country: campaign.country,
    Type: campaign.type,
    'Total List': campaign.totalList ?? '',
    Confirmations: campaign.confirmations ?? '',
    Target: campaign.targetInfluencers,
    Visited: campaign.visited ?? '',
    Coverage: campaign.coverage ?? campaign.targetPostingCoverage,
    Approved: campaign.approved ?? '',
    Reject: campaign.reject ?? '',
    'Daily Target': campaign.dailyTarget ?? '',
    "Today's Visits": campaign.todaysVisits ?? '',
    "Tomorrow's Visits": campaign.tomorrowsVisits ?? '',
    'Day After': campaign.dayAfterVisits ?? '',
    'Start Date': campaign.startDate,
    'End Date': campaign.endDate,
    'Run Rate': campaign.runRate ?? '',
    '% of Target': campaign.targetRate ?? '',
    'Conf Rate %': campaign.confirmationRate ?? '',
    'Cov Rate %': campaign.coverageRate ?? '',
  })));
}

export function exportInfluencers(influencers: CampaignInfluencer[]) {
  exportRows('trygc_influencers_export.xlsx', influencers.map((influencer) => ({
    id: influencer.id,
    campaignId: influencer.campaignId,
    influencerId: influencer.influencerId,
    username: influencer.username,
    platform: influencer.platform,
    status: influencer.status,
    city: influencer.city,
    country: influencer.country,
    niche: influencer.niche,
    followerRange: influencer.followerRange,
    qaStatus: influencer.qaStatus,
    ownerId: influencer.ownerId,
  })));
}

function normalizeValue<T extends string>(value: any, allowed: T[], fallback: T): T {
  const found = allowed.find((item) => item.toLowerCase() === text(value).toLowerCase());
  return found || fallback;
}
