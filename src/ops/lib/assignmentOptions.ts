import type { Campaign, Handover, Task } from '../types';

type AssignmentInput = {
  users?: string[];
  tasks?: Task[];
  campaigns?: Campaign[];
  handovers?: Handover[];
};

const NON_PERSON_LABELS = new Set([
  'campaign manager',
  'community lead',
  'coordination lead',
  'coverage lead',
  'qa lead',
  'finance lead',
  'head of operations',
  'master admin',
  'ops team',
  'regional lead',
  'team lead',
]);

function addName(names: Map<string, string>, value: string | undefined | null) {
  const clean = value?.trim();
  if (!clean) return;
  const key = clean.toLowerCase();
  if (NON_PERSON_LABELS.has(key)) return;
  if (!names.has(key)) names.set(key, clean);
}

export function buildAssignmentOptions(input: AssignmentInput) {
  const names = new Map<string, string>();

  input.users?.forEach((name) => addName(names, name));
  input.tasks?.forEach((task) => addName(names, task.ownerId));
  input.campaigns?.forEach((campaign) => {
    addName(names, campaign.currentOwner);
    campaign.internalOwners?.forEach((owner) => addName(names, owner));
    campaign.clientOwners?.forEach((owner) => addName(names, owner));
  });
  input.handovers?.forEach((handover) => {
    addName(names, handover.outgoingLead);
    addName(names, handover.incomingLead);
    handover.assignFrom?.forEach((owner) => addName(names, owner));
    handover.assignTo?.forEach((owner) => addName(names, owner));
  });

  return [...names.values()].sort((a, b) => a.localeCompare(b));
}
