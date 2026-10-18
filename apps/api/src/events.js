// Invalidation only: no replay buffer, campaign contents, or browser capabilities.
export function createEvents({ heartbeatMs = 15000, maxStreams = 1000 } = {}) {
  const streams = new Set();
  const timers = new Map();
  const campaignListeners = new Set();
  let closed = false;
  function connect(req, res) {
    if (closed || streams.size >= maxStreams) return res.status(503).json({ error: 'Event streams are unavailable. Reconnect shortly.' });
    res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const cleanup = () => { clearInterval(timer); timers.delete(res); streams.delete(res); };
    const timer = setInterval(() => write(res, ': heartbeat\n\n'), heartbeatMs);
    timer.unref();
    timers.set(res, timer);
    res.on('close', cleanup);
    res.on('error', cleanup);
    streams.add(res);
    write(res, 'event: sync-required\ndata: {}\n\n');
  }
  function write(res, message) {
    // Never queue behind a slow client. Reconnection begins with a full sync.
    if (res.destroyed || res.writableEnded) return;
    if (!res.write(message)) res.destroy();
  }
  function publish(name, data) {
    for (const res of streams) write(res, `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  return {
    connect, publish,
    campaignChanged(view) {
      publish('campaign-changed', { campaignId: view.id, revision: view.revision });
      for (const listener of campaignListeners) listener(view);
    },
    onCampaignChange(listener) { campaignListeners.add(listener); return () => campaignListeners.delete(listener); },
    get streamCount() { return streams.size; },
    close() {
      closed = true;
      for (const timer of timers.values()) clearInterval(timer);
      timers.clear();
      for (const res of streams) res.end();
      streams.clear();
    },
  };
}

export const events = createEvents();
