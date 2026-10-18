import { workspaceBreadcrumbs } from './workspaceRoutes.js';

export default function Breadcrumbs({ section, name, id, view }) {
  const items = workspaceBreadcrumbs({ section, name, id, view });
  if (!items.length) return null;
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><ol>
    {items.map((item, index) => <li key={index}>{item.href ? <a href={item.href}>{item.label}</a> : <span aria-current="page">{item.label}</span>}</li>)}
  </ol></nav>;
}
