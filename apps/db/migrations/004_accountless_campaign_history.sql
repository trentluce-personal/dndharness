-- Preserve legacy accounts, personal characters, membership and checkpoints.
ALTER TABLE campaigns ALTER COLUMN dm_id DROP NOT NULL;
ALTER TABLE campaigns ALTER COLUMN invite_code DROP NOT NULL;
ALTER TABLE campaigns ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);

CREATE TABLE campaign_characters (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id uuid NOT NULL,
  name text NOT NULL,
  sheet jsonb NOT NULL,
  PRIMARY KEY (campaign_id, character_id)
);
-- IDs can occur in multiple campaigns; each sheet is the party's own copy.
INSERT INTO campaign_characters (campaign_id, character_id, name, sheet)
SELECT campaign_id, character_id, name, sheet FROM campaign_party;

CREATE TABLE campaign_history (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  revision integer NOT NULL CHECK (revision > 0),
  label text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, revision)
);
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON campaign_history
  FOR EACH ROW EXECUTE FUNCTION reject_save_mutation();

INSERT INTO campaign_history (id, campaign_id, revision, label, snapshot)
SELECT gen_random_uuid(), c.id, c.revision, 'Migration baseline',
  jsonb_build_object(
    'version', 2,
    'campaign', jsonb_build_object('title', c.title, 'editionId', c.edition_id, 'status', c.status),
    'adventure', jsonb_build_object('version', a.version, 'revision', a.revision,
      'title', a.title, 'synopsis', a.synopsis, 'storyline', a.storyline,
      'dmGuidance', a.dm_guidance, 'canvas', a.canvas),
    'state', c.state,
    'party', COALESCE((SELECT jsonb_agg(jsonb_build_object('characterId', p.character_id,
      'name', p.name, 'sheet', p.sheet) ORDER BY p.name, p.character_id)
      FROM campaign_characters p WHERE p.campaign_id = c.id), '[]'::jsonb))
FROM campaigns c JOIN campaign_adventures a ON a.campaign_id = c.id;
