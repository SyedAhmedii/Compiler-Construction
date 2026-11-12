// Vantor compiler: pure module (no Express). Ported from the CS-554 Labs 2-4 PDF.
const KEYWORDS = { hold: 'DECLARE', reveal: 'PRINT', when: 'IF', otherwise: 'ELSE', repeat: 'LOOP', craft: 'CRAFT', on: 'TRUE', off: 'FALSE' };
const TYPES = { num: 'INT_TYPE', frac: 'FLOAT_TYPE', Text: 'STRING_TYPE', Switch: 'BOOL_TYPE', glyph: 'CHAR_TYPE' };
const OPS = { '^=': 'ASSIGN', '^+': 'PLUS', '^-': 'MINUS', '^*': 'MULT', '^/': 'DIV', '^>': 'GT', '^<': 'LT', '^^': 'EQ', '^!': 'NEQ' };
const PUNCT = { '(': 'LPAREN', ')': 'RPAREN', '{': 'LBRACE', '}': 'RBRACE', ',': 'COMMA', ';': 'SEMI' };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const MASTER = new RegExp([
  ['COMMENT', '\\/\\/[^\\n]*'], ['STRING', '"(?:[^"\\\\]|\\\\.)*"'], ['CHAR', "'[^'\\\\\\n]'"],
  ['NUMBER', '\\d+\\.\\d+|\\d+'], ['IDENT', '[A-Za-z_][A-Za-z0-9_]*'],
  ['OP', Object.keys(OPS).map(esc).join('|')], ['PUNCT', Object.keys(PUNCT).map(esc).join('|')],
  ['NEWLINE', '\\n'], ['SKIP', '[ \\t\\r]+'], ['MISMATCH', '.'],
].map(([n, p]) => `(?<${n}>${p})`).join('|'), 'g');

/** Stage 1: source -> tokens (ends with EOF) + lexical errors. */
export function tokenize(src) {
  const tokens = [], errors = [];
  let line = 1, lineStart = 0;
  const push = (type, lexeme, column) => tokens.push({ type, lexeme, line, column });
  for (const m of src.matchAll(MASTER)) {
    const kind = Object.keys(m.groups).find((k) => m.groups[k] !== undefined);
    const v = m[0], col = m.index - lineStart + 1;
    if (kind === 'NEWLINE') { line++; lineStart = m.index + 1; }
    else if (kind === 'STRING' || kind === 'CHAR' || kind === 'NUMBER') push(kind, v, col);
    else if (kind === 'IDENT') push(KEYWORDS[v] || TYPES[v] || 'IDENTIFIER', v, col);
    else if (kind === 'OP') push(OPS[v], v, col);
    else if (kind === 'PUNCT') push(PUNCT[v], v, col);
    else if (kind === 'MISMATCH') errors.push(`Lexical Error at line ${line}: unknown character '${v}'`);
  }
  push('EOF', '', 1);
  return { tokens, errors };
}

const NAMES = { IDENTIFIER: 'identifier', NUMBER: 'number', STRING: 'string', CHAR: 'character', EOF: 'end of file' };
const TYPE_KINDS = Object.values(TYPES);
const SYMBOLS = new Set([...Object.keys(OPS), ...Object.keys(PUNCT)]);

/** Recursive descent parser, one method per grammar rule. Throws Error(message) on the first syntax error. */
class Parser {
  constructor(tokens) {
    // Operators and punctuation use their own symbol as kind so the code reads like the grammar.
    this.t = tokens.map((k) => ({ kind: SYMBOLS.has(k.lexeme) ? k.lexeme : k.type, text: k.type === 'EOF' ? 'end of file' : k.lexeme, line: k.line }));
    this.p = 0;
  }
  peek() { return this.t[this.p].kind; }
  match(kind) {
    const tok = this.t[this.p];
    if (tok.kind !== kind) throw new Error(`Syntax Error at line ${tok.line}: expected '${NAMES[kind] || kind}' but found '${tok.text}'`);
    this.p++; return tok;
  }
  program() { const body = this.stmtList(); this.match('EOF'); return body; }
  stmtList() { const s = []; while (this.peek() !== 'EOF' && this.peek() !== '}') s.push(this.stmt()); return s; }
  stmt() {
    const { kind, text, line } = this.t[this.p];
    if (kind === 'DECLARE') {
      this.p++;
      const tt = this.t[this.p];
      if (!TYPE_KINDS.includes(tt.kind)) throw new Error(`Syntax Error at line ${tt.line}: expected a data type (num, frac, Text, Switch, glyph) but found '${tt.text}'`);
      this.p++;
      const name = this.match('IDENTIFIER').text;
      let init = null;
      if (this.peek() === '^=') { this.p++; init = this.expr(); }
      this.match(';');
      return { tag: 'decl', type: tt.text, name, init, line };
    }
    if (kind === 'IDENTIFIER') {
      this.p++; this.match('^='); const value = this.expr(); this.match(';');
      return { tag: 'assign', name: text, value, line };
    }
    if (kind === 'IF') {
      this.p++; this.match('('); const cond = this.expr(); this.match(')');
      const then = this.block(); let other = null;
      if (this.peek() === 'ELSE') { this.p++; other = this.block(); }
      return { tag: 'if', cond, then, other, line };
    }
    if (kind === 'LOOP') { this.p++; this.match('('); const cond = this.expr(); this.match(')'); return { tag: 'while', cond, body: this.block(), line }; }
    if (kind === 'PRINT') { this.p++; this.match('('); const value = this.expr(); this.match(')'); this.match(';'); return { tag: 'print', value, line }; }
    throw new Error(`Syntax Error at line ${line}: a statement cannot start with '${text}'`);
  }
  block() { this.match('{'); const b = this.stmtList(); this.match('}'); return b; }
  bin(ops, next, self) {
    let left = next.call(this);
    while (ops.includes(this.peek())) {
      const { kind: op, line } = this.t[this.p++];
      left = { tag: 'binop', op, left, right: next.call(this), line };
      if (!self) break; // relop is non-associative: arith [relop arith]
    }
    return left;
  }
  expr() { return this.bin(['^>', '^<', '^^', '^!'], this.arith, false); }
  arith() { return this.bin(['^+', '^-'], this.term, true); }
  term() { return this.bin(['^*', '^/'], this.factor, true); }
  factor() {
    const { kind, text, line } = this.t[this.p];
    const leaf = { NUMBER: text.includes('.') ? 'frac' : 'num', STRING: 'str', CHAR: 'char', TRUE: 'bool', FALSE: 'bool', IDENTIFIER: 'id' }[kind];
    if (leaf) { this.p++; return { tag: leaf, text, line }; }
    if (kind === '(') { this.p++; const e = this.expr(); this.match(')'); return e; }
    throw new Error(`Syntax Error at line ${line}: expected an expression but found '${text}'`);
  }
}

/** Parse tree as {label, children} JSON for a collapsible tree view (mirrors show_tree in the PDF). */
export function toTree(node) {
  if (Array.isArray(node)) return node.map(toTree);
  const kids = (...xs) => xs.flat().filter(Boolean);
  switch (node.tag) {
    case 'decl': return { label: `Declaration: ${node.type} ${node.name}`, children: node.init ? [toTree(node.init)] : [] };
    case 'assign': return { label: `Assignment: ${node.name}`, children: [toTree(node.value)] };
    case 'if': return { label: 'If', children: kids(
      { label: 'Condition', children: [toTree(node.cond)] }, { label: 'Then', children: toTree(node.then) },
      node.other && { label: 'Else', children: toTree(node.other) }) };
    case 'while': return { label: 'While', children: [{ label: 'Condition', children: [toTree(node.cond)] }, { label: 'Body', children: toTree(node.body) }] };
    case 'print': return { label: 'Print', children: [toTree(node.value)] };
    case 'binop': return { label: `Operator: ${node.op}`, children: [toTree(node.left), toTree(node.right)] };
    default: return { label: `${node.tag[0].toUpperCase()}${node.tag.slice(1)}: ${node.text}`, children: [] };
  }
}

const NUMERIC = ['num', 'frac'];
const compatible = (target, got) => target === got || (target === 'frac' && got === 'num');

/** Stage 3: symbol table + the six semantic rules, collecting every error. */
export function analyze(tree) {
  const symbols = new Map(), errors = [];
  const err = (line, msg) => errors.push(`Semantic Error at line ${line}: ${msg}`);
  const typeOf = (e) => { // null = unknown because of an already reported error
    switch (e.tag) {
      case 'num': case 'frac': return e.tag;
      case 'str': return 'Text';
      case 'char': return 'glyph';
      case 'bool': return 'Switch';
      case 'id':
        if (!symbols.has(e.text)) { err(e.line, `variable '${e.text}' is not declared`); return null; }
        return symbols.get(e.text).type;
    }
    const lt = typeOf(e.left), rt = typeOf(e.right);
    if (lt === null || rt === null) return null;
    const ordering = e.op === '^>' || e.op === '^<';
    if (ordering || ['^+', '^-', '^*', '^/'].includes(e.op)) {
      if (!NUMERIC.includes(lt) || !NUMERIC.includes(rt)) { err(e.line, `operator '${e.op}' needs num or frac operands but got ${lt} and ${rt}`); return null; }
      return ordering ? 'Switch' : (lt === 'frac' || rt === 'frac' ? 'frac' : 'num');
    }
    if (lt !== rt && !(NUMERIC.includes(lt) && NUMERIC.includes(rt))) { err(e.line, `operator '${e.op}' cannot compare ${lt} with ${rt}`); return null; }
    return 'Switch';
  };
  const visit = (stmts) => {
    for (const s of stmts) {
      if (s.tag === 'decl') {
        const got = s.init ? typeOf(s.init) : null; // initializer is checked before the symbol is registered
        if (symbols.has(s.name)) err(s.line, `variable '${s.name}' is already declared at line ${symbols.get(s.name).line}`);
        else symbols.set(s.name, { type: s.type, line: s.line });
        if (got && !compatible(s.type, got)) err(s.line, `cannot store ${got} value in ${s.type} variable '${s.name}'`);
      } else if (s.tag === 'assign') {
        const got = typeOf(s.value);
        if (!symbols.has(s.name)) err(s.line, `variable '${s.name}' is not declared`);
        else if (got && !compatible(symbols.get(s.name).type, got)) err(s.line, `cannot store ${got} value in ${symbols.get(s.name).type} variable '${s.name}'`);
      } else if (s.tag === 'if' || s.tag === 'while') {
        const got = typeOf(s.cond);
        if (got && got !== 'Switch') err(s.line, `condition must be Switch but it is ${got}`);
        visit(s.tag === 'if' ? s.then : s.body);
        if (s.tag === 'if' && s.other) visit(s.other);
      } else typeOf(s.value);
    }
  };
  visit(tree);
  return { symbols: [...symbols].map(([name, v]) => ({ name, ...v })), errors };
}

const OP_SYMBOL = { '^+': '+', '^-': '-', '^*': '*', '^/': '/', '^>': '>', '^<': '<', '^^': '==', '^!': '!=' };

/** Stage 4: three-address code and quadruples [op, arg1, arg2, result]. */
export function generate(tree) {
  const quads = []; let temps = 0, labels = 0;
  const newTemp = () => `t${++temps}`, newLabel = () => `L${++labels}`;
  const emit = (op, a1 = '', a2 = '', res = '') => quads.push({ op, arg1: a1, arg2: a2, result: res });
  const expr = (e) => {
    if (e.tag === 'bool') return e.text === 'on' ? 'true' : 'false';
    if (e.tag !== 'binop') return e.text;
    const a = expr(e.left), b = expr(e.right), t = newTemp();
    emit(OP_SYMBOL[e.op], a, b, t); return t;
  };
  const gen = (stmts) => {
    for (const s of stmts) {
      if (s.tag === 'decl' && s.init) emit('=', expr(s.init), '', s.name);
      else if (s.tag === 'assign') emit('=', expr(s.value), '', s.name);
      else if (s.tag === 'print') emit('print', expr(s.value));
      else if (s.tag === 'if') {
        const c = expr(s.cond), lElse = newLabel();
        emit('ifFalse', c, '', lElse); gen(s.then);
        if (!s.other) emit('label', '', '', lElse);
        else { const lEnd = newLabel(); emit('goto', '', '', lEnd); emit('label', '', '', lElse); gen(s.other); emit('label', '', '', lEnd); }
      } else if (s.tag === 'while') {
        const lStart = newLabel(), lEnd = newLabel(); // both allocated before the condition code
        emit('label', '', '', lStart); const c = expr(s.cond);
        emit('ifFalse', c, '', lEnd); gen(s.body); emit('goto', '', '', lStart); emit('label', '', '', lEnd);
      }
    }
  };
  gen(tree);
  const tac = quads.map(({ op, arg1: a, arg2: b, result: r }) =>
    op === 'label' ? `${r}:` : op === '=' ? `  ${r} = ${a}` : op === 'goto' ? `  goto ${r}` :
    op === 'ifFalse' ? `  ifFalse ${a} goto ${r}` : op === 'print' ? `  print ${a}` : `  ${r} = ${a} ${op} ${b}`);
  return { quads, tac };
}

const MAX_STEPS = 100000;
const DEFAULTS = { num: 0, frac: 0, Text: '', Switch: false, glyph: '' };
const unescape = (s) => s.replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t' }[c] ?? c));

/** Stage 5: executes the quadruples. Returns { output, error }. */
export function run(quads, symbols) {
  const vars = new Map(symbols.map((s) => [s.name, { t: s.type, v: DEFAULTS[s.type] }]));
  const labels = new Map(); quads.forEach((q, i) => q.op === 'label' && labels.set(q.result, i));
  const lit = (a) => {
    if (vars.has(a)) return vars.get(a);
    if (/^\d+$/.test(a)) return { t: 'num', v: Number(a) };
    if (/^\d+\.\d+$/.test(a)) return { t: 'frac', v: Number(a) };
    if (a === 'true' || a === 'false') return { t: 'Switch', v: a === 'true' };
    if (a[0] === '"') return { t: 'Text', v: unescape(a.slice(1, -1)) };
    return { t: 'glyph', v: unescape(a.slice(1, -1)) };
  };
  const show = ({ t, v }) => (t === 'Switch' ? (v ? 'on' : 'off') : t === 'frac' ? (Number.isInteger(v) ? v.toFixed(1) : String(v)) : String(v));
  const out = [];
  let pc = 0, steps = 0;
  try {
    while (pc < quads.length) {
      if (++steps > MAX_STEPS) throw new Error(`Runtime Error: possible infinite loop (more than ${MAX_STEPS} instructions executed)`);
      const { op, arg1, arg2, result } = quads[pc++];
      if (op === 'label') continue;
      if (op === 'goto') pc = labels.get(result);
      else if (op === 'ifFalse') { if (!lit(arg1).v) pc = labels.get(result); }
      else if (op === 'print') out.push(show(lit(arg1)));
      else {
        let val;
        if (op === '=') val = lit(arg1);
        else {
          const a = lit(arg1), b = lit(arg2), anyFrac = a.t === 'frac' || b.t === 'frac';
          if (op === '==' || op === '!=') {
            const eq = a.v === b.v; val = { t: 'Switch', v: op === '==' ? eq : !eq };
          } else if (op === '>' || op === '<') val = { t: 'Switch', v: op === '>' ? a.v > b.v : a.v < b.v };
          else {
            if (op === '/' && b.v === 0) throw new Error(`Runtime Error: division by zero in '${arg1} / ${arg2}'`);
            const r = { '+': a.v + b.v, '-': a.v - b.v, '*': a.v * b.v, '/': anyFrac ? a.v / b.v : Math.trunc(a.v / b.v) }[op];
            val = { t: anyFrac ? 'frac' : 'num', v: r };
          }
        }
        if (vars.get(result)?.t === 'frac' && val.t === 'num') val = { t: 'frac', v: val.v }; // num widens into frac
        vars.set(result, val);
      }
    }
    return { output: out.join('\n'), error: null };
  } catch (e) { return { output: out.join('\n'), error: e.message }; }
}

/** Runs every stage; later stages are marked skipped once one fails. */
export function compile(source) {
  const res = {}, stages = ['lexer', 'parser', 'semantic', 'icg', 'output'];
  const skipFrom = (from, why) => stages.slice(stages.indexOf(from)).forEach((s) => { res[s] = { status: 'skipped', reason: why }; });
  const lex = tokenize(source);
  res.lexer = { status: lex.errors.length ? 'error' : 'ok', tokens: lex.tokens, errors: lex.errors };
  if (lex.errors.length) { skipFrom('parser', 'Lexical analysis failed'); return { status: 'error', failedStage: 'lexer', ...res }; }
  let tree;
  try { tree = new Parser(lex.tokens).program(); } catch (e) {
    res.parser = { status: 'error', correct: false, errors: [e.message], tree: null };
    skipFrom('semantic', 'Syntax analysis failed'); return { status: 'error', failedStage: 'parser', ...res };
  }
  res.parser = { status: 'ok', correct: true, errors: [], tree: toTree(tree) };
  const sem = analyze(tree);
  res.semantic = { status: sem.errors.length ? 'error' : 'ok', symbols: sem.symbols, errors: sem.errors };
  if (sem.errors.length) { skipFrom('icg', 'Semantic analysis failed'); return { status: 'error', failedStage: 'semantic', ...res }; }
  const icg = generate(tree);
  res.icg = { status: 'ok', tac: icg.tac, quads: icg.quads };
  const r = run(icg.quads, sem.symbols);
  res.output = { status: r.error ? 'error' : 'ok', output: r.output, errors: r.error ? [r.error] : [] };
  return { status: r.error ? 'error' : 'ok', failedStage: r.error ? 'output' : null, ...res };
}
