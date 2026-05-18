import { describe, expect, it } from 'vitest';
import { filterCampaignUpdates, isUpdateLinkedToCampaign } from './campaignUpdates';

const campaign = { id: 'C-RED-001', name: 'Red Bull Launch' };

describe('campaignUpdates', () => {
  it('matches updates explicitly linked to a campaign id or name', () => {
    expect(isUpdateLinkedToCampaign({ campaignId: 'C-RED-001', title: 'Flagged issue' }, campaign)).toBe(true);
    expect(isUpdateLinkedToCampaign({ campaignName: 'Red Bull Launch', title: 'Flagged issue' }, campaign)).toBe(true);
  });

  it('matches legacy updates that mention the campaign in text', () => {
    expect(isUpdateLinkedToCampaign({ title: 'Urgent', detail: 'Red Bull Launch coverage is blocked' }, campaign)).toBe(true);
  });

  it('filters unrelated updates out of a campaign details list', () => {
    const updates = [
      { id: '1', campaignId: 'C-RED-001', title: 'Linked' },
      { id: '2', campaignName: 'Another Campaign', title: 'Other' },
      { id: '3', title: 'C-RED-001 handover issue' },
    ];

    expect(filterCampaignUpdates(updates, campaign).map((item) => item.id)).toEqual(['1', '3']);
  });
});
