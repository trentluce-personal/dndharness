import Button from './Button.jsx';
import { campaignUrl } from './workspaceRoutes.js';
import { adventureTitle, adventureSynopsis } from './campaignPlanning.js';

export default function CampaignLibrary({ campaigns, user, editionName, onJoin, onCreate }) {
  return <section className="campaign-library" aria-labelledby="campaign-library-title">
    <div className="campaign-library-intro">
      <div><p className="eyebrow">Your adventure collection</p><h1 id="campaign-library-title">Campaign library</h1><p>Saved adventures with your group. Opening a campaign doesn’t start a live game.</p></div>
      <div className="heading-actions"><Button className="secondary" onClick={onJoin}>Join with code</Button><Button onClick={onCreate}>New campaign</Button></div>
    </div>
    {campaigns.length === 0 ? <div className="campaign-library-empty">
      <span aria-hidden="true">✧</span><h2>Your first adventure belongs here</h2>
      <p>Create a saved campaign to prepare an adventure as its dungeon master (DM), or use an invite code to join an existing campaign with your character.</p>
    </div> : <>
      <p className="campaign-library-caption">Your saved campaigns · {campaigns.length}</p>
      <div className="campaign-library-grid">{campaigns.map((campaign) => <article className="campaign-folio" key={campaign.id}>
        <div className="campaign-folio-cover">
          <div className="campaign-folio-edition">{editionName(campaign.editionId)}</div>
          <svg className="campaign-folio-art" viewBox="0 0 120 64" fill="none" aria-hidden="true"><path d="M8 52h104M20 45l23-26 17 18 16-29 24 37M43 19l-5 17 11-5M76 8l-6 23 10-6 8 9" /><circle cx="26" cy="14" r="5" /><path d="M60 49v10M55 54h10" /></svg>
          <h2>{adventureTitle(campaign)}</h2>
          <span className="campaign-folio-kind">Saved adventure</span>
        </div>
        <div className="campaign-folio-content">
          <p className="campaign-folio-summary">{adventureSynopsis(campaign) || 'No player-safe synopsis yet.'}</p>
          <dl className="campaign-folio-metadata">
            <div><dt>Dungeon master (DM)</dt><dd>{campaign.dm.displayName}</dd></div>
            <div><dt>Your role</dt><dd>{campaign.dm.id === user.id ? 'Dungeon master (DM)' : 'Player'}</dd></div>
            <div><dt>Library state</dt><dd>{campaign.status === 'archived' ? 'Archived' : 'In library'}</dd></div>
          </dl>
          {campaign.status === 'archived' && <p className="campaign-folio-archive">Still accessible. New characters cannot be added while archived.</p>}
          <a className="action-button secondary campaign-folio-open" href={campaignUrl(campaign.id)} aria-label={`Open campaign: ${adventureTitle(campaign)}`}>Open campaign <span aria-hidden="true">→</span></a>
        </div>
      </article>)}</div>
    </>}
  </section>;
}
