/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum CampaignStage {
  INTAKE = 1,
  VALIDATION = 2,
  BLOCKED_MISSING_INPUTS = 3,
  READY_FOR_SETUP = 4,
  SETUP = 5,
  LIST_PREPARATION = 6,
  LIST_REVIEW_APPROVAL = 7,
  INVITATIONS_RUNNING = 8,
  REMINDER_1 = 9,
  REMINDER_2 = 10,
  CONFIRMATIONS_IN_PROGRESS = 11,
  SCHEDULING = 12,
  ACTUAL_EXECUTION = 13,
  COVERAGE_IN_PROGRESS = 14,
  MISSING_COVERAGE_RECOVERY = 15,
  QA_REVIEW = 16,
  CLIENT_REPORTING = 17,
  CLOSURE = 18
}

export const STAGE_NAMES: Record<CampaignStage, string> = {
  [CampaignStage.INTAKE]: "Campaign Creation / Intake",
  [CampaignStage.VALIDATION]: "Campaign Validation",
  [CampaignStage.BLOCKED_MISSING_INPUTS]: "Blocked – Missing Inputs",
  [CampaignStage.READY_FOR_SETUP]: "Ready for Setup",
  [CampaignStage.SETUP]: "Campaign Setup",
  [CampaignStage.LIST_PREPARATION]: "List Preparation",
  [CampaignStage.LIST_REVIEW_APPROVAL]: "List Review / Approval",
  [CampaignStage.INVITATIONS_RUNNING]: "Invitations Running",
  [CampaignStage.REMINDER_1]: "Reminder 1",
  [CampaignStage.REMINDER_2]: "Reminder 2",
  [CampaignStage.CONFIRMATIONS_IN_PROGRESS]: "Confirmations in Progress",
  [CampaignStage.SCHEDULING]: "Visit / Delivery Scheduling",
  [CampaignStage.ACTUAL_EXECUTION]: "Actual Visit / Execution",
  [CampaignStage.COVERAGE_IN_PROGRESS]: "Coverage in Progress",
  [CampaignStage.MISSING_COVERAGE_RECOVERY]: "Missing Coverage Recovery",
  [CampaignStage.QA_REVIEW]: "QA Review",
  [CampaignStage.CLIENT_REPORTING]: "Client Reporting",
  [CampaignStage.CLOSURE]: "Campaign Closure"
};

export enum UserRole {
  ADMIN = "Admin / Owner",
  ACCOUNT_MANAGER = "Account Manager",
  OPS_LEAD = "Ops Lead",
  COMMUNITY = "Community Team",
  COORDINATION = "Coordination Team",
  COVERAGE = "Coverage Team",
  QUALITY = "Quality Team",
  VIEWER = "Viewer / Stakeholder"
}

export enum ClosureOutcome {
  COMPLETED = "Closed – Completed",
  PARTIAL = "Closed – Partial",
  ON_HOLD = "On Hold",
  CANCELLED = "Cancelled"
}

export const VALIDATION_REQUIRED_FIELDS = [
  "clientId", "brandId", "name", "country", "city", 
  "objective", "platforms", "type", "budget", "budgetType",
  "targetInfluencers", "targetPostingCoverage", "startDate", "endDate",
  "deliverables", "briefUrl", "mandatoryTags", "productDetails",
  "internalOwners", "clientOwners", "influencerCriteria"
];
