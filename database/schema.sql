-- SQLite schema. Applied automatically every time the server starts.
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE IF NOT EXISTS compile_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  failed_stage TEXT,
  token_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  output TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_compile_runs_created_at ON compile_runs(created_at);
CREATE TABLE IF NOT EXISTS example_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('valid','syntax_error','semantic_error','icg')),
  source TEXT NOT NULL,
  expected_note TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS language_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lexeme TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL,
  category TEXT NOT NULL,
  meaning TEXT NOT NULL
);
