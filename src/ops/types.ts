/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CampaignStage, UserRole, ClosureOutcome } from './constants';

export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface Company extends BaseEntity {
  name: string;
  type: 'Client' | 'Brand' | 'Partner';
  country: string;
  city: string;
  notes?: string;
}

export interface Contact extends BaseEntity {
  name: string;
  role: string;
  email: string;
  phone: string;
  handle: string;
  platform: string;
  gender: 'Male' | 'Female' | 'Other';
  niche: string;
  followerRange: string;
  country: string;
  city: string;
}

export interface Campaign extends BaseEntity {
  name: string;
  clientId: string;
  brandId: string;
  country: string;
  city: string;
  objective: string;
  platforms: string[];
  type: string;
  budget: number;
  budgetType: string;
  targetInfluencers: number;
  targetPostingCoverage: number;
  startDate: string;
  endDate: string;
  deliverables: string;
  tags: string;
  mentions: string;
  links: string;
  visitRequired: boolean;
  productDetails: string;
  approvalFlow: string;
  reportingCadence: string;
  restrictions: string;
  internalOwners: string[];
  clientOwners: string[];
  influencerCriteria: string;
  currentOwner: string;
  nextAction: string;
  nextActionDeadline?: number;
  stage: CampaignStage;
  status: 'Active' | 'Blocked' | 'Closed' | 'On Hold';
  closureOutcome?: ClosureOutcome;
  recordHealth: 'Healthy' | 'At Risk' | 'Critical';
  missingFields?: string[];
}

export interface CampaignInfluencer extends BaseEntity {
  campaignId: string;
  influencerId: string;
  username: string;
  platform: string;
  city?: string;
  country?: string;
  niche?: string;
  followerRange?: string;
  gender?: string;
  status: 'Pending' | 'Invited' | 'Confirmed' | 'Scheduled' | 'Completed' | 'Dropped';
  invitationWave: number;
  reminder1Sent: boolean;
  reminder2Sent: boolean;
  visitDate?: number;
  visitCompleted: boolean;
  coverageReceived: boolean;
  coverageLink?: string;
  qaStatus: 'Pending' | 'Approved' | 'Rejected' | 'Fix Required';
  notes?: string;
  ownerId: string;
}

export interface PostingCoverage extends BaseEntity {
  campaignId: string;
  influencerId: string;
  campaignInfluencerId: string;
  platform: string;
  link: string;
  coverageDate: number;
  tagsPresent: boolean;
  mentionsPresent: boolean;
  linksPresent: boolean;
  promoCodePresent: boolean;
  briefCompliant: boolean;
  archiveLink?: string;
  qaStatus: 'Pending' | 'Approved' | 'Rejected' | 'Fix Required';
  qaNotes?: string;
  missingReason?: string;
  recoveryStatus: 'N/A' | 'Pending' | 'In Progress' | 'Resolved';
  ownerId: string;
  deadline: number;
}

export interface Blocker extends BaseEntity {
  campaignId: string;
  influencerId?: string;
  coverageId?: string;
  summary: string;
  impact: string;
  status: 'Open' | 'Resolved' | 'Escalated';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  ownerId: string;
  deadline?: number;
}

export interface AuditLog {
  id: string;
  campaignId: string;
  field: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: number;
  reason?: string;
}

export interface Task extends BaseEntity {
  title: string;
  description: string;
  ownerId: string;
  dueDate: number;
  campaignId: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  completed: boolean;
  department?: string;
  output?: string;
  kpi?: string;
  cadence?: string;
  scheduleLabel?: string;
  dailyTaskKey?: string;
  dailyTaskDate?: string;
  completedAt?: number;
  reminders?: TaskReminder[];
  flags?: TaskFlag[];
}

export interface TaskReminder {
  id: string;
  label: string;
  dueAt: number;
  notifiedAt?: number;
}

export interface TaskFlag {
  id: string;
  label: string;
  tone: 'red' | 'orange' | 'purple' | 'green';
  resolved: boolean;
}

export interface Handover extends BaseEntity {
  handoffDate: string;
  fromShift: 'Morning' | 'Mid' | 'Night';
  toShift: 'Morning' | 'Mid' | 'Night';
  team: string;
  region: string;
  outgoingLead: string;  // Deprecated - kept for backward compatibility
  incomingLead: string;  // Deprecated - kept for backward compatibility
  assignFrom: string[];  // New multiselect field (replaces outgoingLead)
  assignTo: string[];    // New multiselect field (replaces incomingLead)
  notes: string;
  taskIds: string[];
  status: 'Pending' | 'Acknowledged' | 'Reviewed';
  reviewedAt?: number;
  acknowledgedAt?: number;
}
