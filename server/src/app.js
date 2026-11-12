import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { compile } from './compiler/index.js';
import { db } from './db.js';
import { KEYWORD_ROWS, GRAMMAR, SEMANTIC_RULES, TYPE_TABLE } from './language.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/compile', (req, res) => {
  const { source } = req.body ?? {};
  if (typeof source !== 'string') return res.status(400).json({ error: 'source (string) is required' });
  const t0 = performance.now();
  const result = compile(source);
  const ms = Math.round(performance.now() - t0);
  const errors = ['lexer', 'parser', 'semantic', 'output'].reduce((n, s) => n + (result[s]?.errors?.length || 0), 0);
  try { // history is best-effort: it must never break compiling
    db.prepare('INSERT INTO compile_runs (source, status, failed_stage, token_count, error_count, output, duration_ms) VALUES (?,?,?,?,?,?,?)')
      .run(source, result.status, result.failedStage, result.lexer.tokens.length, errors, result.output?.output ?? null, ms);
  } catch (e) { console.error('history insert failed:', e.message); }
  res.json({ ...result, durationMs: ms });
});

app.get('/api/examples', (_req, res) => res.json(db.prepare('SELECT slug, title, category, source, expected_note FROM example_programs ORDER BY id').all()));

app.get('/api/language', (_req, res) => res.json({
  keywords: KEYWORD_ROWS.map(([lexeme, token_type, category, meaning]) => ({ lexeme, token_type, category, meaning })),
  grammar: GRAMMAR, semanticRules: SEMANTIC_RULES, typeTable: TYPE_TABLE,
}));

app.get('/api/programs', (_req, res) => res.json(db.prepare('SELECT id, title, source, created_at, updated_at FROM programs ORDER BY updated_at DESC, id DESC').all()));
app.post('/api/programs', (req, res) => {
  const { title, source } = req.body ?? {};
  if (typeof title !== 'string' || !title.trim() || title.length > 120 || typeof source !== 'string') return res.status(400).json({ error: 'title (1-120 chars) and source are required' });
  const r = db.prepare('INSERT INTO programs (title, source) VALUES (?,?)').run(title.trim(), source);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.delete('/api/programs/:id', (req, res) => {
  const r = db.prepare('DELETE FROM programs WHERE id = ?').run(Number(req.params.id));
  res.status(r.changes ? 200 : 404).json({ deleted: r.changes });
});
app.get('/api/history', (_req, res) => res.json(db.prepare(
  'SELECT id, source, status, failed_stage, token_count, error_count, duration_ms, created_at FROM compile_runs ORDER BY created_at DESC, id DESC LIMIT 50').all()));

export default app;
