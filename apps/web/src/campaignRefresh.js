import { createRevisionRefreshPolicy } from './campaignDrafts.js';

// A pending read is not evidence of a newer save. Keep the internal trailing-read
// policy separate from the notice shown to someone protecting a draft.
export function createCampaignRefreshPolicy(initialRevision = 0) {
  const policy = createRevisionRefreshPolicy(initialRevision);
  let known = initialRevision;
  let installed = initialRevision;
  let conflict = false;
  return {
    invalidate(revision = 0) { known = Math.max(known, revision); policy.invalidate(revision); },
    observe(revision) { known = Math.max(known, revision); policy.observe(revision); },
    ticket: () => policy.ticket(),
    install(revision, ticket) {
      known = Math.max(known, revision);
      if (!policy.install(revision, ticket)) return false;
      installed = revision;
      conflict = false;
      return true;
    },
    markConflict() { conflict = true; },
    get pending() { return policy.pending; },
    get changesAvailable() { return conflict || known > installed; },
  };
}
