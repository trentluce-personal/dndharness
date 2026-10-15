import { campaignUrl } from './workspaceRoutes.js';

export default function Breadcrumbs({ section, name, id, view }) {
  const labels = { characters: 'Characters', campaigns: 'Campaigns', dice: 'Dice roller', profile: 'Profile', missing: 'Unavailable' };
  if (section === 'table') return null;
  const url = section === 'dice' ? '/dice' : `/${section}`;
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><ol>
    <li><a href="/">Home</a></li>
    <li>{name ? <a href={url}>{labels[section]}</a> : <span aria-current="page">{labels[section]}</span>}</li>
    {name && <li>{view && id ? <a href={campaignUrl(id)}>{name}</a> : <span aria-current="page">{name}</span>}</li>}
    {view && <li><span aria-current="page">{view === 'planning' ? 'Planning canvas' : 'Existing play progress'}</span></li>}
  </ol></nav>;
}
