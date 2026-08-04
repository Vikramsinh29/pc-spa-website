PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  activation_key_hash TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'expired', 'revoked')),
  activation_limit INTEGER NOT NULL DEFAULT 1 CHECK (activation_limit > 0),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  fingerprint_hash TEXT NOT NULL UNIQUE,
  name TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS license_activations (
  id TEXT PRIMARY KEY NOT NULL,
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  activated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deactivated_at TEXT,
  FOREIGN KEY (license_id) REFERENCES licenses (id) ON DELETE RESTRICT,
  FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE RESTRICT,
  UNIQUE (license_id, device_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses (user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_state ON licenses (state);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices (user_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_license_id ON license_activations (license_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_device_id ON license_activations (device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
