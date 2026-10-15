import { useRef, useState } from 'react';
import Button from './Button.jsx';

export const emptyInventory = () => ({ items: [], coins: Object.fromEntries(['cp', 'sp', 'ep', 'gp', 'pp'].map((key) => [key, null])) });

export function EquipmentEditor({ inventory, legacy, onChange, onLegacyChange }) {
  const [removed, setRemoved] = useState(null);
  const rowIds = useRef(inventory.items.map(() => crypto.randomUUID()));
  const undoButton = useRef(null);
  const changeItem = (index, key, value) => onChange({ ...inventory, items: inventory.items.map((item, position) => position === index ? { ...item, [key]: value } : item) });
  return <fieldset className="equipment-editor"><legend>Equipment</legend>
    {inventory.items.length === 0 && <p className="form-note">No items yet.</p>}
    <div className="equipment-rows">{inventory.items.map((item, index) => <details className="inventory-item" key={rowIds.current[index]} ref={(node) => { if (node && !item.name) node.open = true; }}>
      <summary><span className="inventory-item-name">{item.name || 'New item'}</span><span className="inventory-item-quantity">{item.quantity == null ? 'Qty —' : `× ${item.quantity}`}</span><span className="inventory-item-weight">{item.weight || 'Weight —'}</span><span className="inventory-edit-hint" aria-hidden="true">Edit <span>⌄</span></span></summary>
      <div className="equipment-row">
      <label>Item name<input aria-label={`Item ${index + 1} name`} required maxLength={200} value={item.name} onChange={(event) => changeItem(index, 'name', event.target.value)} /></label>
      <label>Quantity<input aria-label={`Item ${index + 1} quantity`} type="number" min="0" max="100000" placeholder="Unknown" value={item.quantity ?? ''} onChange={(event) => changeItem(index, 'quantity', event.target.value === '' ? null : Number(event.target.value))} /></label>
      <label>Listed weight<input aria-label={`Item ${index + 1} listed weight`} maxLength={80} placeholder="—" value={item.weight} onChange={(event) => changeItem(index, 'weight', event.target.value)} /></label>
      <Button className="secondary small" aria-label={`Remove item ${index + 1}: ${item.name || 'unnamed'}`} onClick={() => { const [id] = rowIds.current.splice(index, 1); setRemoved({ item, index, id }); onChange({ ...inventory, items: inventory.items.filter((_, position) => position !== index) }); requestAnimationFrame(() => undoButton.current?.querySelector('button')?.focus()); }}>Remove</Button>
      </div>
    </details>)}</div>
    {removed && <div className="inventory-undo" ref={undoButton}><p role="status">{removed.item.name || 'Item'} removed.</p><Button className="text-button small" disabled={inventory.items.length >= 200} onClick={(event) => { const items = [...inventory.items]; const index = Math.min(removed.index, items.length); items.splice(index, 0, removed.item); rowIds.current.splice(index, 0, removed.id); const fieldset = event.currentTarget.closest('fieldset'); onChange({ ...inventory, items }); setRemoved(null); requestAnimationFrame(() => fieldset.querySelectorAll('summary')[index]?.focus()); }}>Undo</Button></div>}
    <Button className="secondary small" disabled={inventory.items.length >= 200} onClick={(event) => { rowIds.current.push(crypto.randomUUID()); onChange({ ...inventory, items: [...inventory.items, { name: '', quantity: 1, weight: '' }] }); const fieldset = event.currentTarget.closest('fieldset'); requestAnimationFrame(() => { const input = fieldset.querySelector('.inventory-item:last-child input'); input?.focus(); }); }}>+ Add item</Button>
    <h3 className="equipment-subheading">Coins</h3><div className="coin-grid">{[['cp', 'Copper'], ['sp', 'Silver'], ['ep', 'Electrum'], ['gp', 'Gold'], ['pp', 'Platinum']].map(([key, label]) => <label key={key}>{label} ({key})<input type="number" min="0" max="1000000000" placeholder="—" value={inventory.coins[key] ?? ''} onChange={(event) => onChange({ ...inventory, coins: { ...inventory.coins, [key]: event.target.value === '' ? null : Number(event.target.value) } })} /></label>)}</div>
    <label>Equipment notes (optional)<textarea rows="3" maxLength={10000} value={legacy ?? ''} onChange={(event) => onLegacyChange(event.target.value)} /></label>
  </fieldset>;
}

export function EquipmentRead({ sheet }) {
  return <section className="equipment-read"><h4>Equipment</h4>{sheet.inventory && <><ul>{sheet.inventory.items.map((item, index) => <li key={index}><strong>{item.name}</strong><span>{item.quantity == null ? 'Quantity unknown' : `× ${item.quantity}`}{item.weight ? ` · ${item.weight}` : ''}</span></li>)}</ul><p>{Object.entries(sheet.inventory.coins).filter(([, value]) => value != null).map(([key, value]) => `${value} ${key}`).join(' · ') || 'No coins recorded.'}</p></>}{sheet.equipment && <p className="preserve-lines">{sheet.equipment}</p>}</section>;
}
