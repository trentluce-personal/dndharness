import { adventureTitle } from './campaignPlanning.js';

export function hostCampaignSelection(campaigns, campaignId, captured) {
  const selected = campaigns.find(({ id }) => id === campaignId);
  const matching = captured?.id === campaignId ? captured : null;
  const latest = matching && selected && matching.revision >= selected.revision ? matching : selected;
  const unavailable = !!campaignId && (!selected || latest.status !== 'active');
  const options = campaigns.filter((entry) => entry.status === 'active' && entry.id !== campaignId)
    .map((entry) => ({ id: entry.id, label: adventureTitle(entry), disabled: false }));
  if (campaignId) options.unshift({
    id: campaignId,
    label: `${selected || matching ? adventureTitle(latest ?? matching) : 'Selected campaign'}${unavailable ? latest?.status === 'archived' ? ' — Archived' : ' — Unavailable' : ''}`,
    disabled: unavailable,
  });
  return {
    options, unavailable, selected,
    canHost: !!campaignId && !unavailable && matching?.status === 'active',
  };
}
