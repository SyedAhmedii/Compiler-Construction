import Database from 'better-sqlite3';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { EXAMPLES } from './examples.js';
import { KEYWORD_ROWS } from './language.js';

// The whole database is one file; it is created and seeded automatically on startup.
// On Vercel only /tmp is writable (and it is wiped between cold starts), so use it there.
const file = process.env.DB_FILE
  || (process.env.VERCEL ? '/tmp/vantor.db' : fileURLToPath(new URL('../../database/vantor.db', import.meta.url)));
export const db = new Database(file);
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8'));

db.transaction(() => {
  db.prepare('DELETE FROM language_keywords').run();
  const kw = db.prepare('INSERT INTO language_keywords (lexeme, token_type, category, meaning) VALUES (?,?,?,?)');
  KEYWORD_ROWS.forEach((r) => kw.run(...r));
  db.prepare('DELETE FROM example_programs').run();
  const ex = db.prepare('INSERT INTO example_programs (slug, title, category, source, expected_note) VALUES (?,?,?,?,?)');
  EXAMPLES.forEach((e) => ex.run(e.slug, e.title, e.category, e.source, e.expected_note));
})();
