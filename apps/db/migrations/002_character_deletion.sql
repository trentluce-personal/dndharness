-- Retain character IDs referenced by campaign copies and immutable snapshots.
ALTER TABLE characters ADD COLUMN deleted_at timestamptz;
