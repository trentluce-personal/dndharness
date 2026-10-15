import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api.js';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import CharacterForm from './CharacterForm.jsx';
import CampaignDetail from './CampaignDetail.jsx';
import CampaignOverview from './CampaignOverview.jsx';
import CampaignPlanningCanvas from './CampaignPlanningCanvas.jsx';
import { adventureTitle, adventureSynopsis } from './campaignPlanning.js';
import DiceTray from './DiceTray.jsx';
import AdventureActions from './AdventureActions.jsx';
import CharacterImport from './CharacterImport.jsx';
import LandingHero from './LandingHero.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import PersonalCharacterPage from './PersonalCharacterPage.jsx';
import DeleteCharacter from './DeleteCharacter.jsx';
import CampaignLibrary from './CampaignLibrary.jsx';
import { sections, characterUrl, campaignUrl } from './workspaceRoutes.js';

export default function AccountWorkspace({ user, setUser, editions, editionId, navigation }) {
  const { route } = navigation;
  const tab = route.section;
  const setTab = (id) => navigation.navigate(sections.find(([key]) => key === id)?.[2] ?? '/');
  const [characters, setCharacters] = useState([]); const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [modal, setModal] = useState(null);
  const [loadedUser, setLoadedUser] = useState(null);
  const [reload, setReload] = useState(0);
  const selected = tab === 'campaigns' && route.id ? campaigns.find((entry) => entry.id === route.id) : null;
  const setSelected = (campaign) => { if (campaign) { navigation.navigate(campaignUrl(campaign.id)); } };
  const personal = tab === 'characters' && route.id ? characters.find((entry) => entry.id === route.id) : null;
  const dataReady = loadedUser === user?.id && !loading;
  const [authMode, setAuthMode] = useState('register');
  const [afterCharacter, setAfterCharacter] = useState(null);
  const [discardImport, setDiscardImport] = useState(false);
  const [characterBusy, setCharacterBusy] = useState(false);
  const [addedCharacter, setAddedCharacter] = useState(null);
  const [characterMessage, setCharacterMessage] = useState('');
  const characterStatus = useRef(null);
  useEffect(() => { setCharacterMessage(''); setAddedCharacter(null); setModal(null); }, [user?.id]);
  async function deleteCharacter(character) {
    await api(`/characters/${character.id}`, 'DELETE', {});
    setCharacters((current) => current.filter((entry) => entry.id !== character.id));
    setAddedCharacter((current) => current?.id === character.id ? null : current);
    setModal(null);
    setCharacterMessage(`${character.name} deleted from your character library.`);
    if (tab === 'characters' && route.id === character.id) {
      navigation.protect({ dirty: false, busy: false });
      navigation.navigate('/characters', { force: true });
    }
    requestAnimationFrame(() => characterStatus.current?.focus());
  }
  function closeModal() {
    if (characterBusy) return;
    if (modal?.draft) { setDiscardImport(true); return; }
    setModal(modal?.type === 'import' && afterCharacter ? { type: 'join', inviteCode: afterCharacter.inviteCode } : null); setAfterCharacter(null);
  }
  useEffect(() => { if (!['character', 'import'].includes(modal?.type)) setAfterCharacter(null); }, [modal]);
  useEffect(() => {
    setCharacters([]); setCampaigns([]); setLoadedUser(null);
    if (!user) { setLoading(false); return; }
    let live = true; setLoading(true); setError('');
    Promise.all([api('/characters'), api('/campaigns')]).then(([characters, campaigns]) => { if (live) { setCharacters(characters); setCampaigns(campaigns); setLoadedUser(user.id); } }).catch((error) => { if (live) setError(error.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [user?.id, reload]);
  const editionName = (id) => editions.find((edition) => edition.id === id)?.shortName ?? id;
  async function logOut() {
    try { await api('/auth/logout', 'POST', {}); setUser(null); setAddedCharacter(null); navigation.navigate('/', { force: true }); }
    catch (error) { setError(error.message); }
  }
  function updateCampaign(campaign) { setCampaigns((current) => current.map((entry) => entry.id === campaign.id ? campaign : entry)); }
  const tabs = [['table', 'Home'], ['characters', 'Characters'], ['campaigns', 'Campaigns'], ['dice', 'Dice roller']];
  if (!user) return <section className="entry-workspace">
    <Breadcrumbs section={tab} name={route.id ? tab === 'campaigns' ? 'Campaign' : 'Character sheet' : undefined} id={route.id} view={route.view} />
    {tab !== 'table' && tab !== 'dice' && <p className="form-note">Log in to open this destination. Your link will be kept while you sign in.</p>}
    <LandingHero onRegister={() => { setAuthMode('register'); setModal({ type: 'auth' }); }} onLogin={() => { setAuthMode('login'); setModal({ type: 'auth' }); }} />
    <div className="landing-divider" aria-hidden="true"><span />✧<span /></div>
    <DiceTray welcoming />
    {modal && <Dialog title={authMode === 'register' ? 'Create your account' : 'Log in'} onClose={() => setModal(null)}><AuthForm mode={authMode} onMode={setAuthMode} onSuccess={(user) => { setUser(user); setModal(null); }} /></Dialog>}
  </section>;
  return <div className="account-workspace">
    {document.getElementById('account-header-actions') && createPortal(<div className="account-header-controls" aria-label="Account controls"><a href="/profile" className={`action-button secondary small${tab === 'profile' ? ' account-selected' : ''}`} aria-current={tab === 'profile' ? 'page' : undefined}>Profile</a><Button className="text-button small" disabled={navigation.actionBusy} onClick={() => navigation.request({ run: logOut, busy: true })}>{navigation.actionBusy ? 'Logging out…' : 'Log out'}</Button></div>, document.getElementById('account-header-actions'))}
    <nav className="workspace-nav" aria-label="Game workspace"><div className="workspace-tabs">{tabs.map(([id, label]) => <a href={sections.find(([key]) => key === id)[2]} key={id} className={`action-button nav-tab secondary${tab === id ? ' selected' : ''}`} aria-current={tab === id && !route.id ? 'page' : undefined}>{label}</a>)}</div></nav>
    <Breadcrumbs section={tab} name={route.id ? (dataReady ? personal?.name ?? (selected ? adventureTitle(selected) : 'Unavailable') : 'Loading…') : undefined} id={route.id} view={route.view} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {characterMessage && <p className="form-note" role="status" tabIndex={-1} ref={characterStatus}>{characterMessage}</p>}
    {addedCharacter && <div className="character-added"><p role="status"><span aria-hidden="true">✦</span> <strong>{addedCharacter.name}</strong> added to your characters.</p><a className="action-button secondary small" href={characterUrl(addedCharacter.id)}>Open character sheet</a><Button className="text-button small" aria-label="Dismiss character added message" onClick={() => setAddedCharacter(null)}>Dismiss</Button></div>}
    {!dataReady ? error ? <Button className="secondary" onClick={() => setReload((value) => value + 1)}>Try again</Button> : <p className="loading-note" role="status">Loading your characters and campaigns…</p> : personal ? <PersonalCharacterPage key={`${user.id}:${personal.id}`} character={personal} editions={editions} navigation={navigation} onDelete={() => deleteCharacter(personal)} onSave={async (body) => { const saved = await api(`/characters/${personal.id}`, 'PATCH', body); setCharacters((current) => current.map((entry) => entry.id === saved.id ? saved : entry)); setAddedCharacter((current) => current?.id === saved.id ? saved : current); return saved; }} /> : selected ? route.view === 'progress' ? <CampaignDetail key={selected.id} initial={selected} user={user} characters={characters} editions={editions} onBack={() => navigation.navigate(campaignUrl(selected.id))} onUpdate={updateCampaign} /> : route.view === 'planning' ? <CampaignPlanningCanvas key={`planning:${user.id}:${selected.id}`} campaign={selected} user={user} navigation={navigation} onUpdate={updateCampaign} /> : <CampaignOverview key={`overview:${user.id}:${selected.id}`} campaign={selected} user={user} editions={editions} navigation={navigation} onUpdate={updateCampaign} /> : route.id || tab === 'missing' ? <section className="workspace-panel"><h1>{tab === 'campaigns' ? 'Campaign unavailable' : 'Character unavailable'}</h1><p className="form-note">This destination is unavailable to your account. It may have been removed.</p><a className="action-button secondary" href={tab === 'campaigns' ? '/campaigns' : '/characters'}>Back to {tab === 'campaigns' ? 'campaigns' : 'characters'}</a></section> : <>
      {tab !== 'campaigns' && <div className="dashboard-intro"><p className="eyebrow">Your local D&amp;D organizer</p><h1>{tab === 'table' ? <>Welcome, <em>{user.displayName}.</em></> : tab === 'characters' ? 'Your characters' : tab === 'dice' ? 'Dice roller' : 'Your profile'}</h1><p>{tab === 'table' ? 'Your characters. Your adventures. All in one place.' : tab === 'characters' ? 'The characters you play, with their health, abilities, and equipment.' : tab === 'profile' ? 'Your public name, private details, and password.' : 'Choose your dice and roll. Only you can see the results.'}</p></div>}
      {tab === 'campaigns' ? <CampaignLibrary campaigns={campaigns} user={user} editionName={editionName} onJoin={() => setModal({ type: 'join' })} onCreate={() => setModal({ type: 'campaign' })} /> : tab === 'profile' ? <Profile user={user} setUser={setUser} /> : tab === 'dice' ? <DiceTray /> : <>
        {tab === 'table' && (campaigns.length === 0 ? <AdventureActions onCharacter={() => setModal({ type: 'import' })} onJoin={() => setModal({ type: 'join' })} onCampaign={() => setModal({ type: 'campaign' })} onDice={() => setTab('dice')} /> : <div className="home-shortcuts"><p>Pick up where your group left off.</p><Button className="secondary" onClick={() => setTab('dice')}>Roll dice</Button></div>)}
        {(tab === 'table' || tab === 'campaigns') && <section className="collection-section"><div className="section-heading"><div><p className="eyebrow">The next chapter awaits</p><h2>{tab === 'table' ? 'Your campaigns' : 'Campaign library'}</h2></div><div className="heading-actions"><Button className="secondary small" onClick={() => setModal({ type: 'join' })}>Join with code</Button><Button className="small" onClick={() => setModal({ type: 'campaign' })}>+ New campaign</Button></div></div>
          {campaigns.length === 0 ? <Empty title="No campaigns yet" text="Have an invite code? Join your group’s adventure. Want to run the game? Create a campaign as the dungeon master." /> : <div className="collection-grid">{campaigns.map((campaign) => <a href={campaignUrl(campaign.id)} key={campaign.id} className="campaign-tile"><div className="tile-heading"><span className="quiet-badge">{editionName(campaign.editionId)}</span><span className="tile-role">{campaign.dm.id === user.id ? 'Dungeon master (DM)' : 'Player'}</span></div><span className="tile-art" aria-hidden="true">✧</span><h3>{adventureTitle(campaign)}</h3><p>{adventureSynopsis(campaign) || 'No player-safe synopsis yet.'}</p><div className="tile-footer"><span>{campaign.status === 'archived' ? 'Archived' : 'In library'}</span><span>Open →</span></div></a>)}</div>}
        </section>}
         {(tab === 'table' || tab === 'characters') && <section className="collection-section"><div className="section-heading"><div><p className="eyebrow">Faces around the table</p><h2>Your characters</h2></div><Button className="small" onClick={() => setModal({ type: 'import' })}>Import character sheet</Button></div>
          {characters.length === 0 ? <Empty title="No characters yet" text="Import your D&D Beyond PDF to bring your character here, then join your group’s campaign." /> : <div className="collection-grid">{characters.map((character) => <article className="character-tile" key={character.id}><div className="tile-heading"><span className="quiet-badge">{editionName(character.editionId)}</span><span className="character-monogram" aria-hidden="true">{character.name.slice(0, 1)}</span></div><h3>{character.name}</h3><p>Level {character.sheet.level} {character.sheet.class || 'Adventurer'}{character.sheet.ancestry ? ` · ${character.sheet.ancestry}` : ''}</p><div className="stat-strip"><span>Maximum HP <strong>{character.sheet.maxHp}</strong></span><span>Armor class (AC) <strong>{character.sheet.ac}</strong></span></div><div className="character-card-actions"><a className="action-button secondary small" href={characterUrl(character.id)}>Open character sheet <span aria-hidden="true">↗</span></a><DeleteCharacter compact name={character.name} onDelete={() => deleteCharacter(character)} /></div></article>)}</div>}
        </section>}
      </>}
    </>}
    {modal && <Dialog key={modal.type} busy={characterBusy} className={modal.draft ? 'import-review-dialog' : ''} title={modal.type === 'import' ? 'Import character sheet' : modal.type === 'character' ? modal.character ? modal.character.name : 'Review imported character' : modal.type === 'campaign' ? 'Create a campaign' : 'Join a campaign'} onClose={closeModal}>
      {modal.type === 'import' ? <CharacterImport onImport={(draft) => setModal({ type: 'character', draft })} /> : modal.type === 'character' ? <CharacterForm onDelete={modal.character ? () => deleteCharacter(modal.character) : undefined} onBusyChange={setCharacterBusy} character={modal.character} draft={modal.draft} editions={editions} editionId={editionId} onCancel={() => { setModal(afterCharacter ? { type: 'join', inviteCode: afterCharacter.inviteCode } : null); setAfterCharacter(null); }} onSave={async (body) => { const result = await api(modal.character ? `/characters/${modal.character.id}` : '/characters', modal.character ? 'PATCH' : 'POST', body); setDiscardImport(false); setCharacters((current) => [result, ...current.filter((entry) => entry.id !== result.id)]); if (modal.draft) setAddedCharacter(result); else setAddedCharacter((current) => current?.id === result.id ? result : current); setModal((current) => current === modal ? afterCharacter ? { type: 'join', inviteCode: afterCharacter.inviteCode, characterId: result.id } : null : current); }} /> : modal.type === 'campaign' ? <CampaignForm editions={editions} editionId={editionId} onSave={(campaign) => { setCampaigns((current) => [campaign, ...current]); setModal(null); setSelected(campaign); }} /> : <JoinForm characters={characters} editions={editions} initialCode={modal.inviteCode} initialCharacter={modal.characterId} onImportCharacter={(inviteCode) => { setAfterCharacter({ inviteCode }); setModal({ type: 'import' }); }} onJoin={(campaign) => { setCampaigns((current) => [campaign, ...current.filter((entry) => entry.id !== campaign.id)]); setModal(null); setSelected(campaign); }} />}
    </Dialog>}
    {discardImport && <Dialog title="Discard imported character?" onClose={() => setDiscardImport(false)}><p>The imported sheet and your changes have not been saved.</p><div className="form-actions"><Button className="secondary" onClick={() => setDiscardImport(false)}>Keep editing</Button><Button onClick={() => { setDiscardImport(false); setModal(afterCharacter ? { type: 'join', inviteCode: afterCharacter.inviteCode } : null); setAfterCharacter(null); }}>Discard draft</Button></div></Dialog>}
    {navigation.pending && <Dialog title="Discard unsaved changes?" initialFocus=".keep-character-editing" onClose={() => navigation.resolve(false)}><p>Your changes have not been saved. Leaving this page will discard them.</p><div className="form-actions"><Button className="secondary keep-character-editing" onClick={() => navigation.resolve(false)}>Keep editing</Button><Button onClick={() => navigation.resolve(true)}>Discard changes</Button></div></Dialog>}
  </div>;
}
function Empty({ title, text }) { return <div className="empty-state"><span aria-hidden="true">✧</span><h3>{title}</h3><p>{text}</p></div>; }
function AuthForm({ mode, onMode, onSuccess }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <form className="editor-form" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(''); const data = Object.fromEntries(new FormData(event.currentTarget)); try { onSuccess((await api(`/auth/${mode}`, 'POST', data)).user); } catch (error) { setError(error.message); } finally { setBusy(false); } }}>
    <p className="form-note">Your account stays on this server. Email is your login name; no verification or recovery emails are sent.</p>
    {mode === 'register' && <label>Display name<input name="displayName" required maxLength={80} autoComplete="nickname" /></label>}
    <label>Email<input type="email" name="email" required maxLength={254} autoComplete="email" /></label><label>Password<input type="password" name="password" required minLength={10} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /><span className="field-hint">At least 10 characters</span></label>
    {error && <p role="alert" className="form-error">{error}</p>}<Button type="submit" disabled={busy}>{busy ? mode === 'register' ? 'Creating account…' : 'Logging in…' : mode === 'register' ? 'Create account' : 'Log in'}</Button><Button className="text-button" disabled={busy} onClick={() => { setError(''); onMode(mode === 'register' ? 'login' : 'register'); }}>{mode === 'register' ? 'Already have an account? Log in' : 'New here? Create an account'}</Button>
  </form>;
}
function CampaignForm({ editions, editionId, onSave }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <form className="editor-form" onSubmit={async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); setBusy(true); setError(''); try { onSave(await api('/campaigns', 'POST', { title: data.title, editionId: data.editionId })); } catch (error) { setError(error.message); } finally { setBusy(false); } }}><p className="form-note">Prepare a saved adventure as its dungeon master (DM). Add the synopsis, private storyline, and planning canvas in its overview. Creating a campaign doesn’t start a live game.</p><label>Campaign title<input name="title" required maxLength={150} placeholder="The Last Lantern" /></label><label>Rules edition<select name="editionId" defaultValue={editionId} aria-describedby="campaign-edition-hint">{editions.map((edition) => <option value={edition.id} key={edition.id}>{edition.name}</option>)}</select><span className="field-hint" id="campaign-edition-hint">Choose the version of D&amp;D your group plays. Players need characters with this same edition. You cannot change it later.</span></label>{error && <p role="alert" className="form-error">{error}</p>}<Button type="submit" disabled={busy}>{busy ? 'Creating campaign…' : 'Create campaign'}</Button></form>;
}
function JoinForm({ characters, editions, onJoin, onImportCharacter, initialCode = '', initialCharacter = '' }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState(initialCode);
  return <form className="editor-form" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(''); try { onJoin(await api('/campaigns/join', 'POST', Object.fromEntries(new FormData(event.currentTarget)))); } catch (error) { setError(error.message); } finally { setBusy(false); } }}><p className="form-note">Ask the dungeon master (DM), the person running your adventure, for an invite code and the rules edition to use.</p><label>Invite code<input name="inviteCode" required maxLength={32} autoComplete="off" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} /></label>{characters.length > 0 ? <label>Your character<select name="characterId" required defaultValue={initialCharacter} aria-describedby="join-character-hint"><option value="" disabled>Choose a character</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name} · {editions.find((edition) => edition.id === character.editionId)?.shortName}</option>)}</select><span className="field-hint" id="join-character-hint">The character must use the campaign’s rules edition. Joining creates a separate campaign copy of the sheet.</span></label> : <p className="form-note">Import your D&D Beyond PDF to bring in a character. We’ll keep your invite code and bring you back here.</p>}{error && <p role="alert" className="form-error">{error}</p>}{characters.length > 0 && <Button type="submit" disabled={busy}>{busy ? 'Joining campaign…' : 'Join campaign'}</Button>}<Button className={characters.length ? 'secondary' : ''} disabled={busy} onClick={() => onImportCharacter(inviteCode)}>{characters.length ? 'Import another character sheet' : 'Import character sheet'}</Button></form>;
}
function Profile({ user, setUser }) {
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  return <div className="profile-grid"><section className="workspace-panel"><h2>Your profile</h2><p className="form-note">Email and personal information are private. Party members see your display name.</p><form className="editor-form" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(''); setMessage(''); try { setUser((await api('/profile', 'PATCH', Object.fromEntries(new FormData(event.currentTarget)))).user); setMessage('Profile saved.'); } catch (error) { setError(error.message); } finally { setBusy(false); } }}><label>Email<input value={user.email} readOnly /></label><label>Display name<input name="displayName" defaultValue={user.displayName} required maxLength={80} /></label><label>Real name <span className="field-hint">Optional, private</span><input name="realName" defaultValue={user.realName} maxLength={120} /></label><label>Bio <span className="field-hint">Optional, private</span><textarea name="bio" rows="4" defaultValue={user.bio} maxLength={1000} /></label><Button type="submit" disabled={busy}>Save profile</Button></form></section><section className="workspace-panel"><h2>Change password</h2><p className="form-note">Changing your password signs out other sessions. Email recovery is not available yet.</p><form className="editor-form" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; setBusy(true); setError(''); setMessage(''); try { await api('/profile/password', 'POST', Object.fromEntries(new FormData(form))); form.reset(); setMessage('Password updated. Other sessions signed out.'); } catch (error) { setError(error.message); } finally { setBusy(false); } }}><label>Current password<input type="password" name="currentPassword" required minLength={10} maxLength={128} autoComplete="current-password" /></label><label>New password<input type="password" name="newPassword" required minLength={10} maxLength={128} autoComplete="new-password" /></label><Button type="submit" disabled={busy}>Update password</Button></form></section>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}</div>;
}
