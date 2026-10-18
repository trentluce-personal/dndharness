# Live API runtime

Live sessions are accountless, single-process, in-memory tables. Restarting the
API ends every session; campaigns, checkpoints and complete history remain in
PostgreSQL. Hosting/ending never changes campaign history or revisions. Standalone
sessions require only a title and display name: they never read or write campaigns,
editions, revisions, checkpoints, or history, and create no placeholder campaign.
Multiple standalone sessions can coexist, including ones with the same title.
A campaign
can have one live table; different campaigns can be hosted concurrently. Archived
campaigns cannot newly host. Existing tables continue through archive/revert and
use the **current campaign**, with no pinned adventure source or history version.

`GET /api/live-sessions` returns summaries. `POST /api/live-sessions` accepts
`{title,displayName}` for a standalone table (omit `campaignId`). Title must be text
with 1–150 characters after trimming; display name must be text with 1–100 characters
after trimming. Success is 201 with the existing detail shape:
`{id,campaignId:null,title,editionId:null,hostName,startedAt,participantCount,revision,participants,self}`.
`participants` contains `{id,displayName,isHost}`; `self` contains
`{participantId,isHost,joined}`. The host starts joined, with one participant and
session revision 1. Summaries also include explicit null campaign/edition IDs;
there is no campaign content or capability in either response.

The backward-compatible linked request is `{campaignId,expectedRevision,displayName}`.
Supplying `campaignId` always selects that branch, even if invalid: null, empty,
non-string, or malformed IDs return 400, missing campaigns return 404, and stale
revisions return 409. It never falls back to standalone creation. Linked titles
and editions still come from the campaign; standalone requests need no edition or
expected revision. Additional fields do not create linkage.

Detail is at `GET /api/live-sessions/:id`;
POST `join` accepts `{displayName}`, and POST `heartbeat`, `leave`, `end` accept `{}`.
Only the browser that hosted can end; it must end instead of leave. Other campaign
access remains open. Names are 1–100 trimmed characters. Rejoining from the same
browser preserves its existing name and participant identity (including the host).
The dedicated HttpOnly/Strict cookie is shared by tabs; explicit leave affects all
tabs. Clients heartbeat every 30 seconds. Membership expires after five minutes;
host expiry ends the table. Sweeps run every 30 seconds, also before reads/actions.
There are at most 100 tables and 100 participants per table. Host end is idempotent
for five minutes using at most 100 identity-hash-only tombstones. Missing/expired/
ended detail returns 404; heartbeat by a nonmember returns 403.

Before first host/join, clients must initialize the browser capability using
`POST /api/live-browser {}` (200 `{ready:true}`, issuing an HttpOnly cookie only
when absent). `POST /api/live-browser {probe:true}` returns `{ready:boolean}` and
**never** issues a cookie. Both require an explicit allowed Origin and JSON.
Host/join without a valid cookie returns 428 without issuing a cookie. Direct API
clients should retain the bootstrap response cookie in their cookie jar.

The web helper coordinates first-use bootstrap across tabs using an atomic
IndexedDB marker, supported on insecure HTTP LAN origins. No secret is stored in
JavaScript or IndexedDB. One tab issues the cookie, confirms it with a probe, then
releases the marker. Calls are bounded to 12 seconds. Ambiguous network failure or
tab crash retains the marker: a late Set-Cookie response must not race a replacement
initializer. Tabs can recover automatically if a probe finds the cookie; otherwise
the UI error asks users to wait, or close **all** app tabs and clear site data before
reopening. Never automatically expire/reclaim an uncertain bootstrap marker.
Unavailable IndexedDB or blocked cookies fail closed with an actionable error.

`GET /api/events` is SSE invalidation only: immediate `sync-required {}` on every
connection, `campaign-changed {campaignId,revision}` after successful commits,
`live-sessions-changed {}`, and `live-session-changed {sessionId,revision}`. Session
revision is independent of campaign revision. Clients refetch canonical resources;
there is no replay, source content or capability in events. Heartbeat comments run
every 15 seconds. Slow streams are disconnected rather than buffered, with at
most 1,000 open streams. Shutdown closes streams and registry timers first.

`APP_ORIGINS` is a comma-separated list of exact HTTP(S) origins (no paths,
wildcards, credentials, queries or fragments); default is
`http://127.0.0.1:5173,http://localhost:5173`. Startup rejects invalid configuration.
Supplied hostile origins are rejected for all API requests. Live POST actions
require an explicit allowed Origin; ordinary requests/native EventSource can omit
it. JSON protections still apply to writes. Set `COOKIE_SECURE=true` under HTTPS.
`GET /api/hosting` returns `{lanConfigured,joinUrls}` derived only from configured
nonloopback origins. This indicates configuration, not network reachability.

Run the repository's API test command from its root; fixtures use only the `_test`
database. No live-session migration or new dependency is required.
