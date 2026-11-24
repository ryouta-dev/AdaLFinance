CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires INTEGER NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  group_id TEXT NOT NULL,
  config TEXT NOT NULL,
  state TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS attempts_owner ON attempts (owner, started_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS attempts_group ON attempts (group_id, started_at DESC);
