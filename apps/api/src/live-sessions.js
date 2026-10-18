import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fail, text } from './validation.js';

const cookieName = 'dndharness_live';
export function browserPrincipal(req, res, issue = false) {
  const cookies = (req.headers.cookie ?? '').split(';').map((part) => part.trim());
  let token = cookies.find((part) => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  if (!/^[a-f0-9]{64}$/.test(token ?? '')) {
    if (!issue) return null;
    token = randomBytes(32).toString('hex');
    res.append('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
  }
  return createHash('sha256').update(token).digest('hex');
}

export function requireBrowserPrincipal(req, res) {
  const principal = browserPrincipal(req, res);
  if (!principal) fail('Initialize this browser with POST /api/live-browser before hosting or joining.', 428);
  return principal;
}

export function createLiveSessions({ now = Date.now, publish = () => {}, leaseMs = 300000, sweepMs = 30000, maxSessions = 100, maxParticipants = 100 } = {}) {
  const sessions = new Map();
  const byCampaign = new Map();
  const tombstones = new Map();
  let closed = false;
  function changed(session) {
    publish('live-sessions-changed', {});
    publish('live-session-changed', { sessionId: session.id, revision: session.revision });
  }
  function end(session) {
    sessions.delete(session.id);
    if (session.campaignId !== null && byCampaign.get(session.campaignId) === session.id) byCampaign.delete(session.campaignId);
    tombstones.set(session.id, { principal: session.hostPrincipal, expiresAt: now() + leaseMs });
    while (tombstones.size > 100) tombstones.delete(tombstones.keys().next().value);
    session.revision++;
    changed(session);
  }
  function sweep() {
    const time = now();
    for (const [id, tombstone] of tombstones) if (tombstone.expiresAt <= time) tombstones.delete(id);
    for (const session of sessions.values()) {
      if (session.participants.get(session.hostPrincipal).expiresAt <= time) { end(session); continue; }
      let removed = false;
      for (const [principal, participant] of session.participants) {
        if (participant.expiresAt <= time) { session.participants.delete(principal); removed = true; }
      }
      if (removed) { session.revision++; changed(session); }
    }
  }
  function get(id) {
    sweep();
    const session = sessions.get(id);
    if (!session) fail('Live session has ended or does not exist.', 404);
    return session;
  }
  function summary(session) {
    return { id: session.id, campaignId: session.campaignId, title: session.title, editionId: session.editionId, hostName: session.participants.get(session.hostPrincipal).displayName, startedAt: session.startedAt, participantCount: session.participants.size, revision: session.revision };
  }
  function detail(session, principal) {
    const participant = session.participants.get(principal);
    return { ...summary(session), participants: [...session.participants.entries()].map(([key, value]) => ({ id: value.id, displayName: value.displayName, isHost: key === session.hostPrincipal })), self: { participantId: participant?.id ?? null, isHost: principal === session.hostPrincipal, joined: !!participant } };
  }
  function create({ campaignId, title, editionId }, principal, displayName) {
    if (closed) fail('Live sessions are unavailable during shutdown.', 503);
    sweep();
    if (campaignId !== null && byCampaign.has(campaignId)) fail('This campaign already has an active live session.', 409);
    if (sessions.size >= maxSessions) fail('The live session limit has been reached.', 429);
    const name = text(displayName, 'Display name', 100, true);
    const session = { id: randomUUID(), campaignId, title, editionId, hostPrincipal: principal, startedAt: new Date(now()).toISOString(), revision: 1, participants: new Map([[principal, { id: randomUUID(), displayName: name, expiresAt: now() + leaseMs }]]) };
    sessions.set(session.id, session);
    if (campaignId !== null) byCampaign.set(campaignId, session.id);
    changed(session);
    return detail(session, principal);
  }
  const timer = setInterval(sweep, sweepMs);
  timer.unref();
  return {
    sweep,
    list() { sweep(); return [...sessions.values()].map(summary); },
    detail(id, principal) { return detail(get(id), principal); },
    create(campaign, principal, displayName) {
      return create({ campaignId: campaign.id, title: campaign.adventure?.title ?? campaign.title, editionId: campaign.editionId }, principal, displayName);
    },
    createStandalone(title, principal, displayName) {
      return create({ campaignId: null, title: text(title, 'Session title', 150, true), editionId: null }, principal, displayName);
    },
    join(id, principal, displayName) {
      const session = get(id);
      const name = text(displayName, 'Display name', 100, true);
      const existing = session.participants.get(principal);
      if (existing) existing.expiresAt = now() + leaseMs;
      else {
        if (session.participants.size >= maxParticipants) fail('This session is full.', 429);
        session.participants.set(principal, { id: randomUUID(), displayName: name, expiresAt: now() + leaseMs });
        session.revision++;
        changed(session);
      }
      return detail(session, principal);
    },
    heartbeat(id, principal) {
      const session = get(id);
      const participant = session.participants.get(principal);
      if (!participant) fail('Join this live session first.', 403);
      participant.expiresAt = now() + leaseMs;
      return detail(session, principal);
    },
    leave(id, principal) {
      const session = get(id);
      if (principal === session.hostPrincipal) fail('The host must end the session instead of leaving.', 409);
      if (session.participants.delete(principal)) { session.revision++; changed(session); }
    },
    end(id, principal) {
      sweep();
      if (tombstones.get(id)?.principal === principal) return;
      const session = get(id);
      if (principal !== session.hostPrincipal) fail('Only the session host can end this session.', 403);
      end(session);
    },
    campaignChanged(view) {
      const session = sessions.get(byCampaign.get(view.id));
      if (!session) return;
      session.title = view.adventure?.title ?? view.title;
      session.editionId = view.editionId;
      session.revision++;
      changed(session);
    },
    close() { closed = true; clearInterval(timer); sessions.clear(); byCampaign.clear(); tombstones.clear(); },
  };
}
