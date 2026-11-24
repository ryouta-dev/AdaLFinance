CREATE TABLE IF NOT EXISTS custom_cases (
  group_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  config TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  PRIMARY KEY (group_id, company_id, case_id, version)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS qr_invites (
  digest TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  group_id TEXT NOT NULL,
  expires INTEGER NOT NULL,
  redeemed_at INTEGER
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS team_submissions (
  request_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  username TEXT NOT NULL,
  section TEXT NOT NULL,
  answers TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
  recorded_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_submissions_group ON team_submissions (group_id, recorded_at);
