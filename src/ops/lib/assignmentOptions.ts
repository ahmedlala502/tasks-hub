import type { Campaign, Handover, Task } from '../types';
import { isDisplayablePersonName } from './platformUsers';

type AssignmentInput = {
  users?: string[];
  tasks?: Task[];
  campaigns?: Campaign[];
  handovers?: Handover[];
};

function addName(names: Map<string, string>, value: string | undefined | null) {
  const clean = value?.trim();
  if (!clean) return;
  if (!isDisplayablePersonName(clean)) return;
  const key = clean.toLowerCase().replace(/\s+/g, ' ');
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
