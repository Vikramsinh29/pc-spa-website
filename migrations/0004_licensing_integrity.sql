PRAGMA foreign_keys = OFF;

CREATE TABLE license_activations_new (
  id TEXT PRIMARY KEY NOT NULL,
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  activated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deactivated_at TEXT,
  FOREIGN KEY (license_id) REFERENCES licenses (id) ON DELETE RESTRICT,
  FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE RESTRICT
);

INSERT INTO license_activations_new (id, license_id, device_id, activated_at, deactivated_at)
SELECT id, license_id, device_id, activated_at, deactivated_at
FROM license_activations;

DROP TABLE license_activations;
ALTER TABLE license_activations_new RENAME TO license_activations;

CREATE UNIQUE INDEX idx_license_activations_active_unique
  ON license_activations (license_id, device_id)
  WHERE deactivated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_license_activations_license_id
  ON license_activations (license_id);

CREATE INDEX IF NOT EXISTS idx_license_activations_device_id
  ON license_activations (device_id);

PRAGMA foreign_keys = ON;
