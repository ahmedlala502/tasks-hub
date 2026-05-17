/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Campaign, CampaignInfluencer } from './types';
import { VALIDATION_REQUIRED_FIELDS } from './constants';
import { differenceInDays, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard utility for merging Tailwind classes safely
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const validateCampaign = (campaign: Partial<Campaign>) => {
  const missingFields = VALIDATION_REQUIRED_FIELDS.filter(field => {
    const value = (campaign as any)[field];
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || value === "";
  });

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};

export const calculateKPIs = (campaign: Campaign, influencers: CampaignInfluencer[]) => {
  const target = campaign.targetPostingCoverage || 1;
  const targetInfluencerCount = campaign.targetInfluencers || 1;
  
  const invited = influencers.filter(i => i.status !== 'Pending').length;
  const confirmed = influencers.filter(i => i.status === 'Confirmed' || i.status === 'Scheduled' || i.status === 'Completed').length;
  const visitScheduled = influencers.filter(i => !!i.visitDate).length;
  const actualVisits = influencers.filter(i => i.visitCompleted).length;
  const coverageReceived = influencers.filter(i => i.coverageReceived).length;

  const coverageAchievement = (coverageReceived / target) * 100;
  const confirmationRate = (confirmed / (invited || 1)) * 100;
  const visitToCoverageConversion = (coverageReceived / (actualVisits || 1)) * 100;

  const today = new Date();
  const endDate = parseISO(campaign.endDate);
  const remainingDays = Math.max(1, differenceInDays(endDate, today));
  
  const requiredDailyPace = (target - coverageReceived) / remainingDays;
  
  // Logic: Are we on track?
  const totalDays = differenceInDays(endDate, parseISO(campaign.startDate)) || 1;
  const elapsedDays = totalDays - remainingDays;
  const expectedCoverageSoFar = (target / totalDays) * elapsedDays;
  const runRateStatus = coverageReceived >= expectedCoverageSoFar ? 'On Pace' : 'Below Pace';

  return {
    invited,
    confirmed,
    visitScheduled,
    actualVisits,
    coverageReceived,
    missingCoverage: target - coverageReceived,
    coverageAchievement,
    confirmationRate,
    visitToCoverageConversion,
    requiredDailyPace,
    runRateStatus
  };
};

export const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
    case 'blocked': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
    case 'closed': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    case 'healthy': return 'text-green-600 dark:text-green-400';
    case 'at risk': return 'text-orange-500 dark:text-orange-400';
    case 'critical': return 'text-red-600 dark:text-red-400';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
  }
};
