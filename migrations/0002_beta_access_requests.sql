PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS beta_access_requests (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  source TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_beta_access_requests_created_at
  ON beta_access_requests (created_at DESC);
