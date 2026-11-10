-- The path of a competition's logo (`League::logo`), as its package names it. NULL for a
-- competition that has none. Nothing is filled in here, so every row written before this
-- column starts as NULL.
ALTER TABLE competitions ADD COLUMN logo TEXT;
