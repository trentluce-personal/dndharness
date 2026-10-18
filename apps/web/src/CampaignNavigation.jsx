import { campaignUrl, campaignViews } from './workspaceRoutes.js';

export default function CampaignNavigation({ campaignId, view }) {
  return <nav className="campaign-subnav" aria-label="Campaign pages">
    {campaignViews.map(([key, label]) => <a key={key ?? 'overview'} href={campaignUrl(campaignId, key)} aria-current={view === key ? 'page' : undefined}>{label}</a>)}
  </nav>;
}
