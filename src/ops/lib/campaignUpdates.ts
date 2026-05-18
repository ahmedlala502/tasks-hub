export type CampaignUpdateLink = {
  campaignId?: string | null;
  campaignName?: string | null;
  title?: string | null;
  detail?: string | null;
  owner?: string | null;
};

export type CampaignReference = {
  id?: string | null;
  name?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function campaignTokens(campaign: CampaignReference, routeId?: string | null) {
  return [campaign.id, campaign.name, routeId]
    .map(normalize)
    .filter(Boolean);
}

export function isUpdateLinkedToCampaign(update: CampaignUpdateLink, campaign: CampaignReference, routeId?: string | null) {
  const tokens = campaignTokens(campaign, routeId);
  if (tokens.length === 0) return false;

  const explicit = [update.campaignId, update.campaignName].map(normalize).filter(Boolean);
  if (explicit.some((value) => tokens.includes(value))) return true;

  const haystack = normalize(`${update.title || ''} ${update.detail || ''} ${update.owner || ''}`);
  return tokens.some((token) => token.length >= 3 && haystack.includes(token));
}

export function filterCampaignUpdates<T extends CampaignUpdateLink>(updates: T[], campaign: CampaignReference, routeId?: string | null) {
  return updates.filter((update) => isUpdateLinkedToCampaign(update, campaign, routeId));
}
