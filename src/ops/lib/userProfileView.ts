export type ProfileSummary = {
  tasks: number;
  done: number;
  inProgress: number;
  pending: number;
  blocked: number;
  completionRate: number;
  campaigns: number;
  creators: number;
  handovers: number;
};

export type ProfileMetric = {
  label: string;
  value: number;
  tone: 'green' | 'orange' | 'amber' | 'red' | 'purple' | 'sky' | 'indigo' | 'neutral';
};

export type LinkedProfileMetric = ProfileMetric & {
  to: string;
};

export function getPrimaryProfileMetrics(summary: ProfileSummary): ProfileMetric[] {
  return [
    { label: 'Done', value: summary.done, tone: 'green' },
    { label: 'In Progress', value: summary.inProgress, tone: 'orange' },
    { label: 'Pending', value: summary.pending, tone: 'amber' },
    { label: 'Blocked', value: summary.blocked, tone: 'red' },
  ];
}

export function getSecondaryProfileMetrics(summary: ProfileSummary): ProfileMetric[] {
  return [
    { label: 'All Tasks', value: summary.tasks, tone: 'neutral' },
    { label: 'Campaigns', value: summary.campaigns, tone: 'purple' },
    { label: 'Creators', value: summary.creators, tone: 'sky' },
    { label: 'Handovers', value: summary.handovers, tone: 'indigo' },
  ];
}

export function buildUserProfileHeader({
  viewedName,
  isPerformancePage,
  isTargetUser,
  role,
  office,
  email,
}: {
  viewedName: string;
  isPerformancePage: boolean;
  isTargetUser: boolean;
  role: string;
  office: string;
  email: string;
}) {
  if (!isPerformancePage && !isTargetUser) {
    return {
      eyebrow: 'My Profile',
      title: viewedName,
      detail: email,
    };
  }

  return {
    eyebrow: 'Performance',
    title: viewedName,
    detail: `${role} - ${office}`,
  };
}

function taskWorkPath(userName: string, work: string) {
  const params = new URLSearchParams({ user: userName, work });
  return `/tasks?${params.toString()}`;
}

export function buildPersonalPerformanceLinks(
  userName: string,
  counts: {
    assignedTo: number;
    assignedBy: number;
    completed: number;
    blocked: number;
    handovers: number;
    total: number;
  },
): LinkedProfileMetric[] {
  const handoverParams = new URLSearchParams({ person: userName });
  return [
    { label: 'Assigned To', value: counts.assignedTo, to: taskWorkPath(userName, 'assigned'), tone: 'orange' },
    { label: 'Assigned By', value: counts.assignedBy, to: taskWorkPath(userName, 'created'), tone: 'purple' },
    { label: 'Completed', value: counts.completed, to: taskWorkPath(userName, 'done'), tone: 'green' },
    { label: 'Blocked', value: counts.blocked, to: taskWorkPath(userName, 'blocked'), tone: 'red' },
    { label: 'Handovers', value: counts.handovers, to: `/handover?${handoverParams.toString()}`, tone: 'indigo' },
    { label: 'Total Work', value: counts.total, to: taskWorkPath(userName, 'all'), tone: 'neutral' },
  ];
}
