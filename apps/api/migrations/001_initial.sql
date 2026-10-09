CREATE TABLE editions (
  id text PRIMARY KEY,
  name text NOT NULL,
  short_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX one_default_edition ON editions (is_default) WHERE is_default;
INSERT INTO editions (id, name, short_name, description, is_default, sort_order) VALUES
 ('dnd-5e-2014', '5th edition · 2014', '5e / 2014', 'The original fifth-edition rules, ready for your next adventure.', false, 1),
 ('dnd-5e-2024', '5th edition · 2024', '5e / 2024', 'The revised fifth-edition rules, a new starting point for your table.', true, 2);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  real_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE characters (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  edition_id text NOT NULL REFERENCES editions(id),
  name text NOT NULL,
  sheet jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX characters_owner ON characters(user_id);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY,
  dm_id uuid NOT NULL REFERENCES users(id),
  edition_id text NOT NULL REFERENCES editions(id),
  title text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE campaign_party (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id),
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  sheet jsonb NOT NULL,
  PRIMARY KEY (campaign_id, character_id)
);
CREATE INDEX party_user ON campaign_party(user_id);
CREATE TABLE campaign_saves (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  label text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saves_campaign ON campaign_saves(campaign_id, created_at DESC);

-- Save history is append-only, including for accidental SQL updates.
CREATE FUNCTION reject_save_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Campaign saves are immutable'; END;
$$;
CREATE TRIGGER immutable_saves BEFORE UPDATE OR DELETE ON campaign_saves
  FOR EACH ROW EXECUTE FUNCTION reject_save_mutation();
