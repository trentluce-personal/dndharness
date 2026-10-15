-- Adventure preparation is separate from the party-visible legacy journal.
-- The migration runner wraps schema changes and backfill in one transaction.
CREATE TABLE campaign_adventures (
  campaign_id uuid PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 150),
  synopsis text NOT NULL DEFAULT '' CHECK (length(synopsis) <= 2000),
  storyline text NOT NULL DEFAULT '' CHECK (length(storyline) <= 20000),
  dm_guidance text NOT NULL DEFAULT '' CHECK (length(dm_guidance) <= 20000),
  canvas jsonb
);

-- Old summary/notes retain their shared meaning; never import them as spoilers.
INSERT INTO campaign_adventures (campaign_id, title)
SELECT id, title FROM campaigns;
