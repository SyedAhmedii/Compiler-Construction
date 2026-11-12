import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '';
const api = async (path, opt) => {
  const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opt });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
};
const toast = (msg, kind = 'ok') => window.dispatchEvent(new CustomEvent('toast', { detail: { msg, kind } }));
const SRC_KEY = 'vantor_src';
const DEFAULT_SRC = 'hold num a ^= 5;\nhold num b ^= 10;\nhold num sum;\nsum ^= a ^+ b ^* 2;\nwhen (sum ^> 20) {\n  reveal("big");\n} otherwise {\n  reveal("small");\n}\nreveal(sum);';

// ---- syntax highlighting (one regex pass per line) ----
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const HL = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|('[^'\\]')|(\b\d+(?:\.\d+)?\b)|\b(hold|reveal|when|otherwise|repeat|craft|on|off)\b|\b(num|frac|Text|Switch|glyph)\b|(\^(?:[=+\-*/^!]|&gt;|&lt;))/g;
const highlight = (line) => esc(line).replace(HL, (m, c, s, ch, n, k, t, o) => `<span class="${c ? 'c' : s || ch ? 's' : n ? 'n' : k ? 'k' : t ? 't' : 'o'}">${m}</span>`) || '&#8203;';

function Logo() {
  return (<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#7C5CFF" />
    <path d="M7 21 16 8l9 13" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="16" cy="25" r="2" fill="#FFB020" /></svg>);
}

function Editor({ value, onChange, errs, onRun }) {
  const hl = useRef(null);
  const lines = value.split('\n');
  const sync = (e) => { hl.current.scrollTop = e.target.scrollTop; hl.current.scrollLeft = e.target.scrollLeft; };
  return (
    <div className="editor">
      <div className="hl" ref={hl} aria-hidden="true">
        {lines.map((l, i) => (
          <div key={i} title={errs[i + 1]}><span className={`ln ${errs[i + 1] ? 'err' : ''}`}>{i + 1}</span>
            <span className={errs[i + 1] ? 'errline' : ''} dangerouslySetInnerHTML={{ __html: highlight(l) }} /></div>))}
      </div>
      <textarea aria-label="Vantor source code" spellCheck="false" value={value} onScroll={sync} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && (e.preventDefault(), onRun())} />
    </div>);
}

const Tree = ({ n }) => (n.children.length
  ? <details open><summary>{n.label}</summary><div className="tc">{n.children.map((c, i) => <Tree key={i} n={c} />)}</div></details>
  : <div className="leaf">{n.label}</div>);
const Errs = ({ list }) => (list?.length ? <div>{list.map((e, i) => <p key={i} className="err mono">{e}</p>)}</div> : null);
const Table = ({ head, rows }) => (<table><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
  <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="mono">{String(c)}</td>)}</tr>)}</tbody></table>);

const TABS = [['tokens', 'Tokens'], ['tree', 'Parse tree'], ['symbols', 'Symbol table'], ['tac', 'Three-address code'], ['quads', 'Quadruples'], ['output', 'Output']];
const STEPS = [['lexer', 'Lexer', 'tokens'], ['parser', 'Parser', 'tree'], ['semantic', 'Semantic', 'symbols'], ['icg', 'ICG', 'tac'], ['output', 'Output', 'output']];
const BADGE = { ok: ['pass', 'pass'], error: ['fail', 'fail'], skipped: ['skipped', ''] };

function TabBody({ tab, res }) {
  if (!res) return <p className="muted">Press Run (Ctrl+Enter) to compile your program.</p>;
  const stage = { tokens: 'lexer', tree: 'parser', symbols: 'semantic', tac: 'icg', quads: 'icg', output: 'output' }[tab];
  const s = res[stage];
  if (s.status === 'skipped') return <p className="muted">Skipped: {s.reason}</p>;
  if (tab === 'tokens') return <><Errs list={s.errors} /><Table head={['Type', 'Lexeme', 'Line', 'Column']} rows={s.tokens.map((t) => [t.type, t.lexeme, t.line, t.column])} /></>;
  if (tab === 'tree') return <><p className={s.correct ? 'ok' : 'err'}>{s.correct ? 'Syntax is correct' : 'Syntax is NOT correct'}</p><Errs list={s.errors} />{s.tree?.map((n, i) => <Tree key={i} n={n} />)}</>;
  if (tab === 'symbols') return <><Errs list={s.errors} /><Table head={['Name', 'Type', 'Declared at line']} rows={s.symbols.map((x) => [x.name, x.type, x.line])} /></>;
  if (tab === 'tac') return <pre>{s.tac.join('\n')}</pre>;
  if (tab === 'quads') return <Table head={['#', 'op', 'arg1', 'arg2', 'result']} rows={s.quads.map((q, i) => [i, q.op, q.arg1, q.arg2, q.result])} />;
  return <><pre>{s.output}</pre><Errs list={s.errors} /></>;
}

function Studio({ setStatus }) {
  const [src, setSrc] = useState(() => sessionStorage.getItem(SRC_KEY) ?? DEFAULT_SRC);
  const [res, setRes] = useState(null);
  const [tab, setTab] = useState('tokens');
  const [busy, setBusy] = useState(false);
  useEffect(() => sessionStorage.setItem(SRC_KEY, src), [src]);
  const errs = useMemo(() => {
    const m = {};
    if (res) ['lexer', 'parser', 'semantic', 'output'].forEach((s) => res[s]?.errors?.forEach((e) => { const l = /line (\d+)/.exec(e); if (l) m[l[1]] = e; }));
    return m;
  }, [res]);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api('/api/compile', { method: 'POST', body: JSON.stringify({ source: src }) });
      setRes(r); setTab(r.failedStage ? STEPS.find((s) => s[0] === r.failedStage)[2] : 'output');
      setStatus(`${r.status === 'ok' ? 'Compiled OK' : `Failed at ${r.failedStage}`} · ${r.lexer.tokens.length} tokens · ${r.durationMs} ms`);
    } catch (e) { toast(`Could not reach the compiler: ${e.message}`, 'error'); } finally { setBusy(false); }
  };
  const save = async () => {
    const title = window.prompt('Name this program:');
    if (!title) return;
    try { await api('/api/programs', { method: 'POST', body: JSON.stringify({ title, source: src }) }); toast('Program saved'); } catch (e) { toast(e.message, 'error'); }
  };
  const copy = () => navigator.clipboard.writeText(res?.output?.output ?? '').then(() => toast('Output copied'), () => toast('Copy failed', 'error'));
  const download = () => {
    if (!res?.icg?.tac) return toast('No three-address code yet - run a valid program first', 'error');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([res.icg.tac.join('\n')])), download: 'program.tac' });
    a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="studio">
      <section className="pane" aria-label="Editor">
        <div className="bar"><span className="logo"><Logo /> Vantor Studio</span><span className="sp" />
          <button onClick={save}>Save</button><button onClick={() => { setSrc(''); setRes(null); }}>Clear</button>
          <button className="primary" onClick={run} disabled={busy}>{busy ? 'Running…' : '▶ Run'}</button></div>
        <Editor value={src} onChange={setSrc} errs={errs} onRun={run} />
      </section>
      <section className="pane" aria-label="Pipeline">
        <div className="stepper">{STEPS.map(([k, label, t], i) => {
          const st = res?.[k]?.status; const [cls, txt] = BADGE[st] || ['', 'idle'];
          return <button key={k} className="step" onClick={() => setTab(t)}>{i + 1}. {label} <span className={`badge ${cls}`}>{txt || 'idle'}</span></button>; })}</div>
        <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        <div className="out"><TabBody tab={tab} res={res} /></div>
        <div className="bar"><button onClick={copy}>Copy output</button><button onClick={download}>Download TAC</button></div>
      </section>
    </div>);
}

// Generic data page: loads a list and shows loading / empty / error states.
function useLoad(path) {
  const [state, set] = useState({ data: null, error: null });
  const load = () => api(path).then((data) => set({ data, error: null }), (e) => set({ data: null, error: e.message }));
  useEffect(() => { load(); }, [path]);
  return [state, load];
}
const Async = ({ s, empty, children }) => s.error ? <p className="err">{s.error}</p> : !s.data ? <p className="muted">Loading…</p> : s.data.length === 0 ? <p className="muted">{empty}</p> : children(s.data);

function useOpen() {
  const nav = useNavigate();
  return (source) => { sessionStorage.setItem(SRC_KEY, source); nav('/'); };
}

function Examples() {
  const [s] = useLoad('/api/examples'); const open = useOpen();
  return (<div className="page"><h1>Examples</h1><Async s={s} empty="No examples found.">{(d) => <div className="grid">{d.map((e) => (
    <button key={e.slug} className="card" onClick={() => open(e.source)}><b className="mono">{e.title}</b><br /><span className="badge">{e.category}</span><p className="muted">{e.expected_note}</p></button>))}</div>}</Async></div>);
}

function Reference() {
  const [s] = useLoad('/api/language');
  const d = s.data;
  return (<div className="page"><h1>Language Reference</h1>{s.error && <p className="err">{s.error}</p>}{!d && !s.error && <p className="muted">Loading…</p>}
    {d && <>{['keyword', 'type', 'operator'].map((c) => <div key={c} className="card"><h3>{c}s</h3><Table head={['Lexeme', 'Token', 'Meaning']} rows={d.keywords.filter((k) => k.category === c).map((k) => [k.lexeme, k.token_type, k.meaning])} /></div>)}
      <div className="card"><h3>Grammar</h3><pre>{d.grammar}</pre></div>
      <div className="card"><h3>Semantic rules</h3><ol>{d.semanticRules.map((r) => <li key={r}>{r}</li>)}</ol></div>
      <div className="card"><h3>Type table</h3><Table head={['Vantor', 'Standard', 'Literal']} rows={d.typeTable} /></div></>}</div>);
}

function Saved() {
  const [s, reload] = useLoad('/api/programs'); const open = useOpen();
  const del = (id) => api(`/api/programs/${id}`, { method: 'DELETE' }).then(() => { toast('Deleted'); reload(); }, (e) => toast(e.message, 'error'));
  return (<div className="page"><h1>Saved programs</h1><Async s={s} empty="Nothing saved yet - use Save in the Studio.">{(d) => d.map((p) => (
    <div className="card" key={p.id}><b>{p.title}</b> <span className="muted">{new Date(p.updated_at).toLocaleString()}</span><br />
      <button onClick={() => open(p.source)}>Load</button> <button onClick={() => del(p.id)}>Delete</button></div>))}</Async></div>);
}

function History() {
  const [s] = useLoad('/api/history'); const open = useOpen();
  return (<div className="page"><h1>Run history</h1><Async s={s} empty="No runs yet.">{(d) => <Table head={['When', 'Status', 'Failed stage', 'Tokens', 'Errors', 'ms', '']}
    rows={d.map((r) => [new Date(r.created_at).toLocaleString(), r.status, r.failed_stage || '-', r.token_count, r.error_count, r.duration_ms, ''])} />}</Async>
    {s.data?.length > 0 && <p className="muted">Tip: open a run from the Studio by pasting its source; latest {s.data.length} runs shown.</p>}</div>);
}

const About = () => (<div className="page"><h1>About Vantor Studio</h1><p>A web compiler workbench for the Vantor language, built for Compiler Construction (CS-554). It shows every phase: lexing, parsing, semantic analysis, intermediate code and execution.</p>
  <div className="card"><h3>Team</h3><ul><li>Syed Abeer Bin Haider</li><li>Hasan Kamran</li><li>Syed Muhammad Ahmed</li></ul></div></div>);

const NAV = [['/', '▶', 'Studio'], ['/examples', '❖', 'Examples'], ['/reference', '☰', 'Language'], ['/saved', '★', 'Saved'], ['/history', '⏱', 'History'], ['/about', 'ⓘ', 'About']];

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [status, setStatus] = useState('Ready');
  const [toasts, setToasts] = useState([]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => {
    const on = (e) => { const t = { ...e.detail, id: Math.random() }; setToasts((x) => [...x, t]); setTimeout(() => setToasts((x) => x.filter((y) => y !== t)), 3500); };
    window.addEventListener('toast', on); return () => window.removeEventListener('toast', on);
  }, []);
  return (<div className="shell">
    <nav className="rail" aria-label="Main">{NAV.map(([to, ic, l]) => <NavLink key={to} to={to} end title={l}><b>{ic}</b>{l}</NavLink>)}
      <span className="sp" /><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? '☀' : '☾'}</button></nav>
    <main><Routes><Route path="/" element={<Studio setStatus={setStatus} />} /><Route path="/examples" element={<Examples />} /><Route path="/reference" element={<Reference />} />
      <Route path="/saved" element={<Saved />} /><Route path="/history" element={<History />} /><Route path="/about" element={<About />} /></Routes></main>
    <footer className="status"><span>Vantor Studio</span><span>{status}</span><span>Ctrl+Enter to run</span></footer>
    <div className="toasts" role="status">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
  </div>);
}
