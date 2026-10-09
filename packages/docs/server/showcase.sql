CREATE TABLE IF NOT EXISTS showcase_submissions (
  id uuid PRIMARY KEY,
  identity text NOT NULL,
  play_identity text,
  apple_identity text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  installs bigint CHECK (installs >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS showcase_submissions_active_identity ON showcase_submissions (identity) WHERE status <> 'rejected';
CREATE UNIQUE INDEX IF NOT EXISTS showcase_submissions_active_play ON showcase_submissions (play_identity) WHERE status <> 'rejected';
CREATE UNIQUE INDEX IF NOT EXISTS showcase_submissions_active_apple ON showcase_submissions (apple_identity) WHERE status <> 'rejected';

CREATE INDEX IF NOT EXISTS showcase_submissions_status ON showcase_submissions (status, created_at);

CREATE TABLE IF NOT EXISTS showcase_rate_limits (
  key text PRIMARY KEY,
  window_id bigint NOT NULL,
  count integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS showcase_rate_limits_expiry ON showcase_rate_limits (updated_at);
