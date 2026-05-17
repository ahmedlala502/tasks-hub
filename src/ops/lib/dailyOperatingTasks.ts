import type { Task, TaskReminder } from '../types';

export type DailyOperatingDepartment =
  | 'Operating Rhythm'
  | 'Onboarding'
  | 'WhatsApp / Live Chat'
  | 'Coverage & Monitoring'
  | 'Coordination'
  | 'Quality & Training'
  | 'Systems & Automation'
  | 'Activation'
  | 'Account Managers'
  | 'Data Analysis'
  | 'Campaign Launch Checklist'
  | 'Management Follow-Up'
  | 'End-of-Day Report';

export interface DailyOperatingTaskTemplate {
  templateId: string;
  department: DailyOperatingDepartment;
  ownerId: string;
  title: string;
  output: string;
  kpi: string;
  priorityRank: number;
  cadence: string;
  scheduleLabel: string;
  reminderTimes: string[];
  flags: string[];
}

type TemplateSeed = {
  title: string;
  output: string;
  kpi: string;
  priorityRank: number;
  cadence?: string;
  scheduleLabel?: string;
  reminderTimes?: string[];
  flags?: string[];
};

const DEFAULT_REMINDER_TIMES = ['09:00', '15:00'];
const EOD_REMINDER_TIMES = ['17:00', '22:00'];
const ASSIGNMENT_TIMES = ['05:00', '08:00', '15:00', '22:00'];
const COVERAGE_TIMES = ['06:00', '12:00', '18:00', '23:45'];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildTemplate(
  department: DailyOperatingDepartment,
  ownerId: string,
  seed: TemplateSeed,
): DailyOperatingTaskTemplate {
  const cadence = seed.cadence || 'Daily';
  const scheduleLabel = seed.scheduleLabel || cadence;
  const reminderTimes = seed.reminderTimes?.length ? seed.reminderTimes : DEFAULT_REMINDER_TIMES;

  return {
    templateId: `${slug(department)}-${seed.priorityRank}-${slug(seed.title)}`,
    department,
    ownerId,
    title: seed.title,
    output: seed.output,
    kpi: seed.kpi,
    priorityRank: seed.priorityRank,
    cadence,
    scheduleLabel,
    reminderTimes,
    flags: [
      scheduleLabel,
      `Output: ${seed.output}`,
      `KPI: ${seed.kpi}`,
      ...(seed.flags || []),
    ],
  };
}

function buildDepartment(
  department: DailyOperatingDepartment,
  ownerId: string,
  seeds: TemplateSeed[],
): DailyOperatingTaskTemplate[] {
  return seeds.map((seed) => buildTemplate(department, ownerId, seed));
}

const rhythmTasks = buildDepartment('Operating Rhythm', 'Coordination Lead', [
  {
    priorityRank: 1,
    title: 'Monitor all client groups, influencer communication, live issues, and campaign updates',
    output: 'No missed client or influencer request',
    kpi: '24/7 monitoring coverage',
    cadence: '24/7',
    scheduleLabel: 'Always on',
    reminderTimes: ['00:00', '06:00', '12:00', '18:00'],
    flags: ['Live issue watch', 'Client/influencer SLA'],
  },
  {
    priorityRank: 2,
    title: 'Complete shift handover for open tasks, complaints, blockers, pending confirmations, missed visits, and missing coverage',
    output: 'Clear shift handover',
    kpi: 'Handover accuracy',
    cadence: 'Every shift',
    scheduleLabel: 'Every shift',
    reminderTimes: ['07:00', '15:00', '23:00'],
    flags: ['Handover required', 'Open items transferred'],
  },
  {
    priorityRank: 3,
    title: 'Review all live campaign coverage every 6 hours',
    output: 'Updated coverage tracker',
    kpi: 'Monitoring accuracy',
    cadence: 'Every 6 hours',
    scheduleLabel: 'Every 6 hours',
    reminderTimes: COVERAGE_TIMES,
    flags: ['Coverage watch', '6-hour check'],
  },
  {
    priorityRank: 4,
    title: 'Check posted, missing, rejected, and risky content 4 times daily',
    output: 'Coverage status updated',
    kpi: 'Coverage completion rate',
    cadence: '4 times daily',
    scheduleLabel: '4 daily coverage checks',
    reminderTimes: COVERAGE_TIMES,
    flags: ['Risk content flag', 'Missing coverage flag'],
  },
  {
    priorityRank: 5,
    title: 'Run morning meeting to confirm priorities, blockers, campaign targets, and daily focus',
    output: 'Daily action plan',
    kpi: 'Meeting completion',
    cadence: 'Daily',
    scheduleLabel: 'Morning',
    reminderTimes: ['09:00'],
    flags: ['Daily priorities', 'Blocker review'],
  },
  {
    priorityRank: 6,
    title: 'Review last 48 hours and download/archive all coverage',
    output: 'Proofs saved and missing posts flagged',
    kpi: 'Archiving accuracy',
    cadence: 'Daily',
    scheduleLabel: 'Morning',
    reminderTimes: ['10:00'],
    flags: ['Proof archive', 'Missing posts flag'],
  },
  {
    priorityRank: 7,
    title: 'Assign or redistribute tasks at 5 AM, 8 AM, 3 PM, and 10 PM',
    output: 'Updated owner list',
    kpi: 'Assignment accuracy',
    cadence: '4 times daily',
    scheduleLabel: '5 AM / 8 AM / 3 PM / 10 PM',
    reminderTimes: ASSIGNMENT_TIMES,
    flags: ['Task ownership', 'Redistribution checkpoint'],
  },
  {
    priorityRank: 8,
    title: 'Reschedule missed visits at 11 PM',
    output: 'Missed visits recovered or flagged',
    kpi: 'Missed visit recovery',
    cadence: 'Daily',
    scheduleLabel: '11 PM',
    reminderTimes: ['23:00'],
    flags: ['Missed visit recovery', 'Escalate unrecovered visits'],
  },
  {
    priorityRank: 9,
    title: 'Send final daily campaign status update',
    output: 'EOD report',
    kpi: 'EOD accuracy',
    cadence: 'Daily',
    scheduleLabel: 'End of day',
    reminderTimes: EOD_REMINDER_TIMES,
    flags: ['EOD report required', 'Campaign status closeout'],
  },
]);

const departmentTasks = [
  ...buildDepartment('Onboarding', 'Onboarding Team', [
    ['Add new influencers daily', 'New influencers added to system/app', 'Daily onboarding volume'],
    ['Verify influencer profile details', 'Accurate influencer profiles', 'Data accuracy'],
    ['Ensure full profile completion', 'No missing mandatory data', 'Profile completion rate'],
    ['Ensure influencers update data via system/app', 'Updated influencer database', 'Updated profiles count'],
    ['Add lookalike influencers based on campaign needs', 'Lookalike lists ready', 'Lookalike match quality'],
    ['Support influencers who do not respond or fail onboarding', 'Recovered onboarding cases', 'Recovery rate'],
    ['Ensure app download and onboarding completion', 'Active usable influencer accounts', 'Completed onboarding count'],
    ['Grow influencer base daily', 'Daily growth tracker updated', 'Daily influencer growth'],
  ].map(([title, output, kpi], index) => ({ title, output, kpi, priorityRank: index + 1 }))),
  ...buildDepartment('WhatsApp / Live Chat', 'WhatsApp Team', [
    ['Respond to influencers within 3-5 minutes', 'Fast replies', 'Response time'],
    ['Keep WhatsApp/live chat active across all shifts', '24/7 coverage', 'Shift coverage'],
    ['Handle confirmations', 'Confirmation tracker updated', 'Confirmations count'],
    ['Send and track reminders', 'Reminder tracker updated', 'Reminder completion'],
    ['Manage visit follow-ups', 'Visit status updated', 'Visit accuracy'],
    ['Follow up on missing coverage', 'Missing coverage cases pushed', 'Recovery rate'],
    ['Ensure correct communication and follow-up wording', 'No wrong promises or confusion', 'Chat quality score'],
    ['Reschedule missed visits daily at 11 PM', 'New visit date/time or escalation', 'Missed visit recovery'],
    ['Escalate complaints immediately', 'Complaint raised to owner', 'Escalation speed'],
    ['Submit shift handover', 'Open cases transferred clearly', 'Handover accuracy'],
  ].map(([title, output, kpi], index) => ({
    title,
    output,
    kpi,
    priorityRank: index + 1,
    reminderTimes: title.includes('11 PM') ? ['23:00'] : undefined,
    flags: title.includes('complaints') ? ['Immediate escalation'] : undefined,
  }))),
  ...buildDepartment('Coverage & Monitoring', 'Coverage Lead', [
    ['Review campaigns 4 times per day', 'Live coverage tracker updated', 'Coverage completion rate'],
    ['Check coverage every 6 hours', 'Fresh monitoring status', 'Monitoring accuracy'],
    ['Morning review of last 48 hours', 'Missed posts identified', 'Missed coverage detection'],
    ['Download and archive all coverage', 'Proofs saved correctly', 'Archiving accuracy'],
    ['Track influencer content across all platforms', 'Platform-level coverage status', 'Platform coverage accuracy'],
    ['Follow up with influencers missing posts', 'Recovery list updated', 'Missing recovery rate'],
    ['Ensure coverage is posted within 24 hours', 'Overdue posts flagged', '24-hour compliance'],
    ['Check content against campaign brief', 'Non-compliant posts flagged', 'Brief compliance score'],
    ['Flag misleading, negative, or risky content', 'Risk escalation created', 'Risk detection speed'],
    ['Update system/live reports', 'Live reports match real status', 'Report accuracy'],
  ].map(([title, output, kpi], index) => ({
    title,
    output,
    kpi,
    priorityRank: index + 1,
    reminderTimes: index < 2 ? COVERAGE_TIMES : undefined,
  }))),
  ...buildDepartment('Coordination', 'Coordination Lead', [
    ['Monitor all client groups 24/7', 'No missed client requests', 'Client response time'],
    ['Reply to clients within 3-5 minutes', 'Fast client response', 'Response time'],
    ['Link all GC offices together', 'Egypt/KSA/UAE/Kuwait aligned', 'Cross-office accuracy'],
    ['Manage internal and external communication', 'One aligned update', 'Zero-error communication'],
    ['Assign tasks at 5 AM, 8 AM, 3 PM, 10 PM', 'Owners and tasks assigned', 'Assignment accuracy'],
    ['Ensure client needs are met', 'Requests fulfilled or tracked', 'Client satisfaction'],
    ['Provide onboarding team with lookalike lists', 'Lookalike requests delivered', 'List delivery accuracy'],
    ['Run morning meeting', 'Daily priorities confirmed', 'Meeting completion'],
    ['Run end-of-day meeting', 'Final status confirmed', 'EOD accuracy'],
    ['Complete full shift handover', 'Open items transferred', 'Handover accuracy'],
  ].map(([title, output, kpi], index) => ({
    title,
    output,
    kpi,
    priorityRank: index + 1,
    reminderTimes: title.includes('5 AM') ? ASSIGNMENT_TIMES : undefined,
  }))),
  ...buildDepartment('Quality & Training', 'QA Lead', [
    ['Monitor all departments', 'Daily QA view', 'Quality score'],
    ['Audit WhatsApp chats', 'Communication mistakes flagged', 'Chat QA score'],
    ['Audit coverage', 'Missing/non-compliant coverage flagged', 'Coverage QA score'],
    ['Audit onboarding quality', 'Wrong/incomplete profiles flagged', 'Onboarding QA score'],
    ['Ensure communication accuracy', 'Errors corrected', 'Errors caught vs corrected'],
    ['Solve missing items and errors quickly', 'Issues closed or assigned', 'Resolution time'],
    ['Train agents on repeated mistakes', 'Coaching delivered', 'Training sessions'],
    ['Update teams on new features/process changes', 'Team update shared', 'Update compliance'],
  ].map(([title, output, kpi], index) => ({ title, output, kpi, priorityRank: index + 1 }))),
  ...buildDepartment('Systems & Automation', 'Systems Lead', [
    ['Maintain dashboards', 'Working live dashboards', 'Dashboard uptime'],
    ['Automate reminders', 'Reminder automation running', 'Automation accuracy'],
    ['Automate coverage tracking', 'Reduced manual tracking', 'Manual work reduction'],
    ['Create check-in and performance dashboards', 'Management visibility', 'Dashboard completeness'],
    ['Monitor system uptime', 'No critical downtime', 'System uptime'],
    ['Reduce repetitive manual work', 'Improved workflows', 'Time saved'],
    ['Fix system/process blockers', 'Operational issues resolved', 'Resolution time'],
  ].map(([title, output, kpi], index) => ({ title, output, kpi, priorityRank: index + 1 }))),
  ...buildDepartment('Activation', 'Activation Team', [
    ['Contact 1,000 influencers per day', 'Outreach completed', 'Daily outreach volume'],
    ['Activate influencers who never worked before', 'New active influencers', 'Activation conversion'],
    ['Reactivate inactive influencers', 'Recovered influencers', 'Reactivation rate'],
    ['Target 20-30% activation rate', 'Activated influencer count', 'Activation rate'],
    ['Support campaign needs when influencers do not respond', 'Backup influencer pool', 'Response recovery'],
    ['Track daily responses', 'Response tracker updated', 'Response rate'],
    ['Contribute to monthly growth', 'Monthly activation increase', 'Monthly activations'],
  ].map(([title, output, kpi], index) => ({ title, output, kpi, priorityRank: index + 1 }))),
  ...buildDepartment('Account Managers', 'Account Managers', [
    ['Own client campaign targets', 'Target progress updated', 'Target achievement'],
    ['Manage full campaign delivery', 'Campaign moving as planned', 'Delivery accuracy'],
    ['Communicate with clients', 'Client updates sent', 'Client satisfaction'],
    ['Coordinate delivery across all offices', 'Country execution aligned', 'Cross-office delivery accuracy'],
    ['Review confirmations, visits, coverage, and gaps', 'Daily campaign snapshot', 'Completion rate'],
    ['Escalate blockers', 'Blockers owned and tracked', 'Escalation closure'],
    ['Manage country ownership: KSA, UAE, Kuwait, Egypt', 'Clear country accountability', 'Country target progress'],
    ['Prepare weekly reporting inputs daily', 'Report data ready', 'Reporting accuracy'],
  ].map(([title, output, kpi], index) => ({ title, output, kpi, priorityRank: index + 1 }))),
  ...buildDepartment('Data Analysis', 'Data Analysis Team', [
    ['Validate influencer data before campaigns', 'Clean campaign-ready list', 'Data accuracy'],
    ['Check gender accuracy', 'Correct gender segmentation', 'Gender accuracy'],
    ['Check nationality accuracy', 'Correct nationality segmentation', 'Nationality accuracy'],
    ['Check age accuracy', 'Correct age segmentation', 'Age accuracy'],
    ['Check followers count', 'Updated follower data', 'Follower count accuracy'],
    ['Check WhatsApp active status', 'Reachable influencer list', 'WhatsApp validity rate'],
    ['Filter active, inactive, and blocked influencers', 'Usable campaign lists', 'Filtering accuracy'],
    ['Suggest process improvements', 'Improvement actions', 'Implemented improvements'],
  ].map(([title, output, kpi], index) => ({ title, output, kpi, priorityRank: index + 1 }))),
];

const campaignLaunchTasks = buildDepartment('Campaign Launch Checklist', 'Campaign Manager', [
  ['Filter active influencers', 'Active list', 'Data accuracy'],
  ['Filter inactive influencers', 'Inactive list', 'Filtering accuracy'],
  ['Remove blocked influencers', 'Clean usable list', 'List quality'],
  ['Filter WhatsApp active numbers', 'Reachable list', 'WhatsApp validity rate'],
  ['Mix influencers by follower count', 'Balanced outreach list', 'List balance'],
  ['Activate inactive influencers through Cairo team', 'Backup active pool', 'Activation recovery'],
  ['Share QR and test codes with client', 'Client validation done', 'Client readiness'],
  ['Ensure all booking details are complete', 'Complete campaign brief', 'Brief completeness'],
  ['Collect all exceptions', 'Exception log', 'Exception tracking'],
  ['Confirm emergency contact', 'Emergency contact ready', 'Emergency readiness'],
  ['Update system and live reports', 'Live campaign visibility', 'Report accuracy'],
].map(([title, output, kpi], index) => ({ title, output, kpi, priorityRank: index + 1 })));

const managementFollowUpTasks = buildDepartment('Management Follow-Up', 'Head of Operations', [
  ['Ask Onboarding how many influencers were added today', 'Number added plus incomplete profiles', 'Daily onboarding visibility'],
  ['Ask WhatsApp if all chats are answered within SLA', 'Response time plus pending cases', 'SLA visibility'],
  ['Ask Coverage what is posted, missing, overdue, or rejected', 'Coverage snapshot', 'Coverage visibility'],
  ['Ask Coordination if all client requests are assigned and followed', 'Client request tracker', 'Client request ownership'],
  ['Ask Quality what errors were found today', 'Error log plus corrective action', 'Quality correction'],
  ['Ask Systems if dashboards and automations are working', 'System health update', 'System health'],
  ['Ask Activation if 1,000 influencers were contacted today', 'Outreach plus activation rate', 'Daily activation visibility'],
  ['Ask Account Managers if client targets are on track', 'Target progress plus blockers', 'Target progress'],
  ['Ask Data Analysis if campaign data is clean and usable', 'Data validation status', 'Data readiness'],
].map(([title, output, kpi], index) => ({
  title,
  output,
  kpi,
  priorityRank: index + 1,
  reminderTimes: ['16:00'],
})));

const eodTasks = buildDepartment('End-of-Day Report', 'Coordination Lead', [
  ['Fill today date in EOD report', 'Date captured', 'Report completeness'],
  ['List campaigns covered', 'Active campaigns listed', 'Campaign visibility'],
  ['Record confirmations', 'Total confirmed today', 'Confirmation accuracy'],
  ['Record visits planned, completed, and missed', 'Visit status captured', 'Visit accuracy'],
  ['Record posted, missing, overdue, and rejected coverage', 'Coverage status captured', 'Coverage accuracy'],
  ['Record new client requests and status', 'Client requests captured', 'Client request accuracy'],
  ['Record complaints with owner and status', 'Complaint log updated', 'Complaint ownership'],
  ['Record blockers with owner and ETA', 'Blocker log updated', 'Blocker ownership'],
  ['Record onboarding and activation results', 'Growth/outreach results captured', 'Growth reporting'],
  ['Record quality and system issues', 'Issue summary captured', 'Issue visibility'],
  ['Set tomorrow top 3 priorities', 'Tomorrow priorities ready', 'Next-day readiness'],
].map(([title, output, kpi], index) => ({
  title,
  output,
  kpi,
  priorityRank: index + 1,
  reminderTimes: EOD_REMINDER_TIMES,
})));

export const DAILY_OPERATING_TASK_TEMPLATES: DailyOperatingTaskTemplate[] = [
  ...rhythmTasks,
  ...departmentTasks,
  ...campaignLaunchTasks,
  ...managementFollowUpTasks,
  ...eodTasks,
];

export function getDailyTaskDateKey(value: number | Date = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeToTimestamp(dateKey: string, time: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function priorityFromRank(rank: number): Task['priority'] {
  if (rank <= 2) return 'Critical';
  if (rank <= 5) return 'High';
  if (rank <= 8) return 'Medium';
  return 'Low';
}

function buildDescription(template: DailyOperatingTaskTemplate): string {
  return [
    template.cadence,
    `Output: ${template.output}`,
    `KPI: ${template.kpi}`,
  ].join('\n');
}

function buildReminders(template: DailyOperatingTaskTemplate, dateKey: string): TaskReminder[] {
  return template.reminderTimes.map((time) => ({
    id: `${template.templateId}-${dateKey}-${time}`,
    label: `${time} reminder`,
    dueAt: timeToTimestamp(dateKey, time),
  }));
}

export function createDailyOperatingTask(
  template: DailyOperatingTaskTemplate,
  now: number = Date.now(),
): Task {
  const dateKey = getDailyTaskDateKey(now);
  const reminders = buildReminders(template, dateKey);
  const dueDate = reminders.length ? reminders[reminders.length - 1].dueAt : timeToTimestamp(dateKey, '18:00');

  return {
    id: `DLY-${dateKey}-${template.templateId}`,
    title: template.title,
    description: buildDescription(template),
    ownerId: template.ownerId,
    dueDate,
    campaignId: template.department,
    priority: priorityFromRank(template.priorityRank),
    completed: false,
    department: template.department,
    output: template.output,
    kpi: template.kpi,
    cadence: template.cadence,
    scheduleLabel: template.scheduleLabel,
    dailyTaskKey: template.templateId,
    dailyTaskDate: dateKey,
    reminders,
    flags: template.flags.map((label, index) => ({
      id: `${template.templateId}-${index}`,
      label,
      tone: index === 0 ? 'orange' : 'purple',
      resolved: false,
    })),
    createdAt: now,
    updatedAt: now,
    createdBy: 'daily-operating-model',
  };
}

export function ensureDailyOperatingTasks(
  tasks: Task[],
  now: number = Date.now(),
): { tasks: Task[]; createdCount: number } {
  const dateKey = getDailyTaskDateKey(now);
  const existingKeys = new Set(
    tasks
      .filter((task) => task.dailyTaskDate === dateKey && task.dailyTaskKey)
      .map((task) => task.dailyTaskKey as string),
  );

  const created = DAILY_OPERATING_TASK_TEMPLATES
    .filter((template) => !existingKeys.has(template.templateId))
    .map((template) => createDailyOperatingTask(template, now));

  return {
    tasks: [...created, ...tasks],
    createdCount: created.length,
  };
}

export function completeDailyTask(task: Task, now: number = Date.now()): Task {
  return {
    ...task,
    completed: true,
    completedAt: now,
    updatedAt: now,
    flags: (task.flags || []).map((flag) => ({ ...flag, resolved: true, tone: 'green' })),
  };
}

export function getDueReminderCandidates(
  tasks: Task[],
  now: number = Date.now(),
  notifiedKeys: Set<string> = new Set(),
): Array<{ task: Task; reminder: TaskReminder; notificationKey: string }> {
  return tasks.flatMap((task) => {
    if (task.completed || !task.reminders?.length) return [];

    return task.reminders
      .filter((reminder) => reminder.dueAt <= now)
      .map((reminder) => ({
        task,
        reminder,
        notificationKey: `${task.id}:${reminder.dueAt}`,
      }))
      .filter((item) => !notifiedKeys.has(item.notificationKey));
  });
}
