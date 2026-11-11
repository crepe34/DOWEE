'use strict';
/* =====================================================================
   RoboBench core 1/2 — a small Arduino C/C++ interpreter.
   Models an Arduino Uno: 16-bit int, 8-bit PWM, real timing costs.
   ===================================================================== */
const STMT_COST = 0.0015;   // ms of CPU time per statement (rough Uno speed)
const LOOP_COST = 0.001;
const SLICE = 0.25;         // ms of code that runs before physics catches up
const PWM_PINS = new Set([3, 5, 6, 9, 10, 11]);
const pinName = p => (p >= 14 ? 'A' + (p - 14) : String(p));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

class CError extends Error { constructor(msg, line, hint) { super(msg); this.line = line; this.hint = hint || ''; } }
class RTError extends Error { constructor(msg, line, hint) { super(msg); this.line = line; this.hint = hint || ''; } }

function lev(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length, d = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; }
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function suggest(name, cands) {
  let best = null, bd = 99;
  for (const c of cands) { const d = lev(name, c); if (d < bd) { bd = d; best = c; } }
  if (best && (bd <= 2 || best.toLowerCase() === name.toLowerCase()) && bd < name.length)
    return `Did you mean "${best}"? Spelling and capital letters matter.`;
  return '';
}

/* ---------------- tokenizer ---------------- */
const OPS3 = ['<<=', '>>='];
const OPS2 = ['++', '--', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '->', '::'];
const OPS1 = '+-*/%<>=!&|^~?:;,.()[]{}';
function unesc(c) { return ({ n: '\n', t: '\t', r: '\r', 0: '\0', '\\': '\\', '"': '"', "'": "'" })[c] ?? c; }

function tokenize(src) {
  const T = []; let i = 0, line = 1; const n = src.length;
  const isId0 = c => /[A-Za-z_]/.test(c), isId = c => /[A-Za-z0-9_]/.test(c), isD = c => c >= '0' && c <= '9';
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v' || c === ' ') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const start = line; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      if (i >= n) throw new CError('A /* comment */ is never closed.', start, 'Add */ where the comment should end.');
      i += 2; continue;
    }
    if (c === '#') {
      const start = line; let j = i, text = '';
      while (j < n && src[j] !== '\n') { if (src[j] === '\\' && src[j + 1] === '\n') { j += 2; line++; continue; } text += src[j]; j++; }
      T.push({ t: 'pp', v: text, line: start }); i = j; continue;
    }
    if (isId0(c)) { let j = i + 1; while (j < n && isId(src[j])) j++; T.push({ t: 'id', v: src.slice(i, j), line }); i = j; continue; }
    if (isD(c) || (c === '.' && isD(src[i + 1]))) {
      let j = i, val, isFloat = false;
      if (c === '0' && /[xX]/.test(src[i + 1])) { j = i + 2; while (j < n && /[0-9a-fA-F]/.test(src[j])) j++; val = parseInt(src.slice(i + 2, j), 16); }
      else if (c === '0' && /[bB]/.test(src[i + 1]) && /[01]/.test(src[i + 2])) { j = i + 2; while (j < n && /[01]/.test(src[j])) j++; val = parseInt(src.slice(i + 2, j), 2); }
      else {
        while (j < n && isD(src[j])) j++;
        if (src[j] === '.') { isFloat = true; j++; while (j < n && isD(src[j])) j++; }
        if (/[eE]/.test(src[j] || '') && (isD(src[j + 1] || '') || (/[+-]/.test(src[j + 1] || '') && isD(src[j + 2] || '')))) { isFloat = true; j += 2; while (j < n && isD(src[j])) j++; }
        val = parseFloat(src.slice(i, j));
      }
      let suf = ''; while (j < n && /[uUlLfF]/.test(src[j])) { suf += src[j].toLowerCase(); j++; }
      if (suf.includes('f')) isFloat = true;
      if (j < n && isId(src[j])) throw new CError(`"${src.slice(i, j + 1)}" is not a valid number.`, line, 'Names cannot start with a digit.');
      T.push({ t: 'num', v: val, isFloat, suf, line }); i = j; continue;
    }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== '"') {
        if (src[j] === '\n') throw new CError('This text in quotes never ends.', line, 'Add a closing " on the same line.');
        if (src[j] === '\\') { s += unesc(src[j + 1]); j += 2; } else { s += src[j]; j++; }
      }
      if (j >= n) throw new CError('This text in quotes never ends.', line, 'Add a closing ".');
      T.push({ t: 'str', v: s, line }); i = j + 1; continue;
    }
    if (c === "'") {
      let j = i + 1, s;
      if (src[j] === '\\') { s = unesc(src[j + 1]); j += 2; } else { s = src[j] || ''; j++; }
      if (src[j] !== "'" || !s) throw new CError("A character like 'A' must be exactly one letter inside single quotes.", line, 'Use double quotes for words: "hello".');
      T.push({ t: 'char', v: s.charCodeAt(0), line }); i = j + 1; continue;
    }
    const c3 = src.substr(i, 3), c2 = src.substr(i, 2);
    if (OPS3.includes(c3)) { T.push({ t: 'op', v: c3, line }); i += 3; continue; }
    if (OPS2.includes(c2)) { T.push({ t: 'op', v: c2, line }); i += 2; continue; }
    if (OPS1.includes(c)) { T.push({ t: 'op', v: c, line }); i++; continue; }
    if ('“”‘’'.includes(c)) throw new CError('Curly quotes like “ ” or ‘ ’ do not work in code.', line, 'Retype them as straight quotes " or \'.');
    throw new CError(`The symbol "${c}" can't be used here.`, line);
  }
  T.push({ t: 'eof', v: '', line });
  return T;
}

function preprocess(T, info) {
  const macros = new Map(), out = [];
  const expand = (tk, depth) => {
    if (depth > 20) throw new CError(`#define ${tk.v} refers to itself.`, tk.line);
    for (const b of macros.get(tk.v)) {
      const nb = { ...b, line: tk.line };
      if (nb.t === 'id' && macros.has(nb.v)) expand(nb, depth + 1); else out.push(nb);
    }
  };
  for (const tk of T) {
    if (tk.t === 'pp') {
      const m = tk.v.match(/^#\s*(\w+)\s*(.*)$/);
      if (!m) continue;
      if (m[1] === 'include') { info.includes.push(m[2].trim()); continue; }
      if (m[1] === 'define') {
        const d = m[2].match(/^(\w+)(\()?\s*(.*)$/);
        if (!d) throw new CError('#define needs a name.', tk.line);
        if (d[2]) throw new CError(`#define ${d[1]}(…) with parameters is not supported.`, tk.line, 'Write a normal function instead.');
        macros.set(d[1], tokenize(d[3]).filter(x => x.t !== 'eof'));
      }
      continue;
    }
    if (tk.t === 'id' && macros.has(tk.v)) { expand(tk, 0); continue; }
    out.push(tk);
  }
  return out;
}

/* ---------------- types ---------------- */
const TYPE_WORDS = new Set(['void', 'int', 'float', 'double', 'long', 'short', 'char', 'bool', 'boolean', 'byte', 'word', 'String', 'unsigned', 'signed', 'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t', 'size_t', 'const', 'static', 'volatile']);
const KEYWORDS = new Set(['if', 'else', 'while', 'do', 'for', 'switch', 'case', 'default', 'break', 'continue', 'return', 'struct', 'class', 'enum', 'typedef', 'union', 'goto', 'sizeof', 'new', 'delete']);
function canonType(words, line) {
  const has = w => words.includes(w);
  if (!words.some(w => !['const', 'static', 'volatile'].includes(w))) throw new CError('A type (like int or float) is missing.', line);
  if (has('void')) return 'void';
  if (has('float') || has('double')) return 'float';
  if (has('bool') || has('boolean')) return 'bool';
  if (has('String')) return 'string';
  if (has('byte') || has('uint8_t') || (has('unsigned') && has('char'))) return 'uint8';
  if (has('char')) return 'char';
  if (has('int8_t')) return 'int8';
  if (has('long') || has('int32_t') || has('uint32_t')) return (has('unsigned') || has('uint32_t')) ? 'uint32' : 'int32';
  if (has('word') || has('uint16_t') || has('size_t') || has('unsigned')) return 'uint16';
  return 'int16';
}
const TNAME = { int8: 'int8_t', char: 'char', uint8: 'byte', bool: 'bool', int16: 'int', uint16: 'unsigned int', int32: 'long', uint32: 'unsigned long', float: 'float', string: 'String', void: 'void' };
const RANK = { int8: 1, char: 1, uint8: 1, bool: 1, int16: 2, uint16: 3, int32: 4, uint32: 5, float: 6, string: 7 };
function arith(a, b) {
  if (a === 'string' || b === 'string') return 'string';
  const r = Math.max(RANK[a] || 2, RANK[b] || 2, 2);
  return [null, null, 'int16', 'uint16', 'int32', 'uint32', 'float'][r];
}
const WRAP = {
  int8: v => (Math.trunc(v) << 24) >> 24,
  char: v => (Math.trunc(v) << 24) >> 24,
  uint8: v => Math.trunc(v) & 255,
  bool: v => (v ? 1 : 0),
  int16: v => (Math.trunc(v) << 16) >> 16,
  uint16: v => Math.trunc(v) & 65535,
  int32: v => Math.trunc(v) | 0,
  uint32: v => Math.trunc(v) >>> 0,
  float: v => Math.fround(+v),
  string: v => String(v),
  void: v => v,
};
function fmtNum(x, type, dec) {
  if (type === 'string') return String(x);
  if (typeof x === 'string') return x;
  if (type === 'char' && dec === undefined) return String.fromCharCode(x & 255);
  if (type === 'float') {
    if (Number.isNaN(x)) return 'nan';
    if (!Number.isFinite(x)) return 'inf';
    return x.toFixed(dec === undefined ? 2 : clamp(Math.trunc(dec), 0, 10));
  }
  if (dec === 16 || dec === 2 || dec === 8) return ((type === 'int32' || type === 'int16') && x < 0 ? (x >>> 0) : x).toString(dec).toUpperCase();
  return String(x);
}

/* ---------------- parser ---------------- */
const BIN_PREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
const LIB_HINT = {
  Servo: 'The Servo library is not in this simulator yet.',
  NewPing: 'Use pulseIn() with the TRIG and ECHO pins instead of NewPing.',
  SoftwareSerial: 'Use the normal Serial: here the HC-05 Bluetooth module is wired to pins 0 and 1.',
  Int: 'Types are lowercase: int', Float: 'Types are lowercase: float', Void: 'Types are lowercase: void', Bool: 'Types are lowercase: bool', Long: 'Types are lowercase: long', string: 'Text type is String with a capital S.',
};
const isLvalue = e => e.k === 'var' || e.k === 'idx';
const nameOf = e => (e.k === 'var' ? e.name : e.k === 'idx' ? nameOf(e.a) : 'value');
function desc(t) {
  if (t.t === 'eof') return 'the end of the program';
  if (t.t === 'str') return 'text "' + t.v + '"';
  if (t.t === 'num') return 'the number ' + t.v;
  return '"' + t.v + '"';
}

class Parser {
  constructor(T) { this.T = T; this.p = 0; }
  get cur() { return this.T[this.p]; }
  peek(k = 1) { return this.T[Math.min(this.p + k, this.T.length - 1)]; }
  is(v) { const c = this.cur; return (c.t === 'op' || c.t === 'id') && c.v === v; }
  isOp(v) { return this.cur.t === 'op' && this.cur.v === v; }
  next() { return this.T[this.p++]; }
  accept(v) { if (this.is(v)) { this.p++; return true; } return false; }
  expect(v, what) { if (this.is(v)) return this.next(); this.fail(v, what); }
  fail(v, what) {
    const c = this.cur, prev = this.T[this.p - 1];
    if (v === ';') { const ln = prev ? prev.line : c.line; throw new CError(`Missing ; at the end of line ${ln}.`, ln, 'Every instruction ends with a semicolon ;'); }
    if (v === ')') throw new CError(`Missing ) — found ${desc(c)} instead.`, c.line, 'Every ( needs a matching ).');
    if (v === ']') throw new CError(`Missing ] — found ${desc(c)} instead.`, c.line);
    if (v === '{') throw new CError(`Expected { ${what || ''} but found ${desc(c)}.`, c.line);
    throw new CError(`Expected "${v}"${what ? ' ' + what : ''} but found ${desc(c)}.`, c.line);
  }
  isTypeStart() {
    const c = this.cur;
    if (c.t !== 'id' || !TYPE_WORDS.has(c.v)) return false;
    const n = this.peek();
    return !(n.t === 'op' && n.v === '(');
  }
  parseTypeWords() {
    const w = [], line = this.cur.line;
    while (this.cur.t === 'id' && TYPE_WORDS.has(this.cur.v)) w.push(this.next().v);
    if (this.isOp('*')) throw new CError('Pointers (*) are not supported in this simulator.', line);
    if (this.isOp('&')) throw new CError('References (&) are not supported here.', line, 'Pass normal values, or use a global variable.');
    return { type: canonType(w, line), isConst: w.includes('const') };
  }
  parseProgram() {
    const prog = { globals: [], funcs: new Map() };
    while (this.cur.t !== 'eof') {
      if (this.accept(';')) continue;
      const c = this.cur;
      if (c.t === 'id' && ['struct', 'class', 'enum', 'typedef', 'union', 'template', 'namespace', 'using'].includes(c.v))
        throw new CError(`"${c.v}" is not supported in this simulator yet.`, c.line);
      if (!this.isTypeStart()) {
        if (c.t === 'id' && this.peek().t === 'id') throw new CError(`Unknown type "${c.v}".`, c.line, LIB_HINT[c.v] || suggest(c.v, [...TYPE_WORDS]) || 'Use a type like int, long, float, bool, byte or char.');
        if (c.t === 'op' && c.v === '}') throw new CError('There is an extra } here.', c.line, 'Each } must close a { that was opened before it.');
        throw new CError(`${desc(c)} is outside of any function.`, c.line, 'Instructions must go inside setup() { … } or loop() { … }.');
      }
      const { type, isConst } = this.parseTypeWords();
      const nameTk = this.cur;
      if (nameTk.t !== 'id') throw new CError('A name is missing after the type.', nameTk.line);
      if (this.peek().t === 'op' && this.peek().v === '(') {
        this.next(); this.next();
        const params = this.parseParams();
        if (this.accept(';')) continue; // prototype
        if (!this.isOp('{')) this.fail('{', 'to start the function body');
        const body = this.parseBlock();
        if (prog.funcs.has(nameTk.v)) throw new CError(`The function ${nameTk.v}() is written twice.`, nameTk.line);
        prog.funcs.set(nameTk.v, { name: nameTk.v, ret: type, params, body, line: nameTk.line });
      } else {
        prog.globals.push(this.parseDeclRest(type, isConst, nameTk.line));
      }
    }
    return prog;
  }
  parseParams() {
    const ps = [];
    if (this.accept(')')) return ps;
    if (this.is('void') && this.peek().v === ')') { this.next(); this.next(); return ps; }
    for (;;) {
      if (!this.isTypeStart()) throw new CError('Each function input needs a type, like "int speed".', this.cur.line);
      const { type } = this.parseTypeWords();
      const nm = this.cur;
      if (nm.t !== 'id') throw new CError('An input name is missing.', nm.line);
      this.next();
      let isArray = false;
      if (this.accept('[')) { if (!this.isOp(']')) this.parseExpr(); this.expect(']'); isArray = true; }
      ps.push({ name: nm.v, type, isArray, line: nm.line });
      if (this.accept(',')) continue;
      this.expect(')'); break;
    }
    return ps;
  }
  parseDeclRest(type, isConst, line) {
    const decls = [];
    do {
      const nm = this.next();
      if (nm.t !== 'id') throw new CError('A variable name is missing.', nm.line);
      if (TYPE_WORDS.has(nm.v) || KEYWORDS.has(nm.v)) throw new CError(`"${nm.v}" is a reserved word and can't be a variable name.`, nm.line);
      if (this.isOp('(')) throw new CError(`Functions must be written outside other functions. Is a } missing before "${nm.v}"?`, nm.line);
      const dims = [];
      while (this.accept('[')) { if (this.isOp(']')) dims.push(null); else dims.push(this.parseCond()); this.expect(']'); }
      let init = null;
      if (this.accept('=')) init = this.isOp('{') ? this.parseInitList() : this.parseAssign();
      else if (this.isOp('{') && dims.length) init = this.parseInitList();
      decls.push({ name: nm.v, dims, init, line: nm.line });
    } while (this.accept(','));
    this.expect(';');
    return { k: 'decl', type, isConst, decls, line };
  }
  parseInitList() {
    const line = this.cur.line; this.expect('{');
    const items = [];
    while (!this.isOp('}')) { items.push(this.isOp('{') ? this.parseInitList() : this.parseAssign()); if (!this.accept(',')) break; }
    this.expect('}');
    return { k: 'list', items, line };
  }
  parseBlock() {
    const line = this.cur.line; this.expect('{');
    const body = [];
    while (!this.isOp('}')) {
      if (this.cur.t === 'eof') throw new CError('Missing } — a { was opened here but never closed.', line, 'Count your curly brackets: each { needs a matching }.');
      body.push(this.parseStmt());
    }
    this.next();
    return { k: 'block', body, line };
  }
  parseStmt() {
    const c = this.cur, line = c.line;
    if (c.t === 'op') { if (c.v === '{') return this.parseBlock(); if (c.v === ';') { this.next(); return { k: 'empty', line }; } }
    if (c.t === 'id') {
      switch (c.v) {
        case 'if': { this.next(); this.expect('(', 'after if'); const cond = this.parseExpr(); this.expect(')'); const t = this.parseStmt(); let f = null; if (this.accept('else')) f = this.parseStmt(); return { k: 'if', c: cond, t, f, line }; }
        case 'while': { this.next(); this.expect('(', 'after while'); const cond = this.parseExpr(); this.expect(')'); const b = this.parseStmt(); return { k: 'while', c: cond, b, line }; }
        case 'do': { this.next(); const b = this.parseStmt(); this.expect('while', 'after the do { } block'); this.expect('('); const cond = this.parseExpr(); this.expect(')'); this.expect(';'); return { k: 'do', b, c: cond, line }; }
        case 'for': {
          this.next(); this.expect('(', 'after for');
          let init = null;
          if (this.isTypeStart()) { const { type, isConst } = this.parseTypeWords(); init = this.parseDeclRest(type, isConst, line); }
          else if (!this.accept(';')) { init = { k: 'expr', e: this.parseExpr(), line }; this.expect(';'); }
          const cond = this.isOp(';') ? null : this.parseExpr(); this.expect(';');
          const step = this.isOp(')') ? null : this.parseExpr(); this.expect(')');
          const b = this.parseStmt();
          return { k: 'for', init, c: cond, step, b, line };
        }
        case 'switch': {
          this.next(); this.expect('('); const e = this.parseExpr(); this.expect(')'); this.expect('{');
          const body = [], labels = [];
          while (!this.isOp('}')) {
            if (this.cur.t === 'eof') throw new CError('Missing } at the end of the switch.', line);
            if (this.is('case')) { const ln = this.cur.line; this.next(); const v = this.parseCond(); this.expect(':', 'after the case value'); labels.push({ v, at: body.length, line: ln }); }
            else if (this.is('default')) { this.next(); this.expect(':'); labels.push({ v: null, at: body.length, line: this.cur.line }); }
            else body.push(this.parseStmt());
          }
          this.next();
          return { k: 'switch', e, body, labels, line };
        }
        case 'break': this.next(); this.expect(';'); return { k: 'break', line };
        case 'continue': this.next(); this.expect(';'); return { k: 'continue', line };
        case 'return': { this.next(); let e = null; if (!this.isOp(';')) e = this.parseExpr(); this.expect(';'); return { k: 'return', e, line }; }
        case 'else': throw new CError('"else" without a matching "if".', line, 'Check the { } brackets just before else.');
        case 'case': case 'default': throw new CError(`"${c.v}" can only be used inside a switch.`, line);
        case 'goto': throw new CError('goto is not supported.', line);
      }
      if (this.isTypeStart()) { const { type, isConst } = this.parseTypeWords(); return this.parseDeclRest(type, isConst, line); }
      if (this.peek().t === 'id' && !KEYWORDS.has(c.v))
        throw new CError(`Unknown type "${c.v}".`, line, LIB_HINT[c.v] || suggest(c.v, [...TYPE_WORDS]) || 'Or is a ; or an operator missing?');
    }
    const e = this.parseExpr();
    this.expect(';');
    return { k: 'expr', e, line };
  }
  parseExpr() { let e = this.parseAssign(); while (this.isOp(',')) { const line = this.next().line; e = { k: 'comma', a: e, b: this.parseAssign(), line }; } return e; }
  parseAssign() {
    const lhs = this.parseCond(), c = this.cur;
    if (c.t === 'op' && ASSIGN_OPS.has(c.v)) {
      this.next();
      if (!isLvalue(lhs)) throw new CError(`The left side of ${c.v} must be a variable.`, c.line, c.v === '=' ? 'To compare two values use == .' : '');
      return { k: 'assign', op: c.v, a: lhs, b: this.parseAssign(), line: c.line };
    }
    return lhs;
  }
  parseCond() {
    const c = this.parseBin(1);
    if (this.isOp('?')) { const line = this.next().line; const a = this.parseExpr(); this.expect(':', 'in the ? : expression'); const b = this.parseCond(); return { k: 'cond', c, a, b, line }; }
    return c;
  }
  parseBin(minP) {
    let a = this.parseUnary();
    for (;;) {
      const c = this.cur; if (c.t !== 'op') break;
      const p = BIN_PREC[c.v]; if (!p || p < minP) break;
      this.next();
      a = { k: 'bin', op: c.v, a, b: this.parseBin(p + 1), line: c.line };
    }
    return a;
  }
  parseUnary() {
    const c = this.cur;
    if (c.t === 'op') {
      if (['!', '~', '-', '+'].includes(c.v)) { this.next(); return { k: 'un', op: c.v, a: this.parseUnary(), line: c.line }; }
      if (c.v === '++' || c.v === '--') { this.next(); const a = this.parseUnary(); if (!isLvalue(a)) throw new CError(`${c.v} only works on a variable.`, c.line); return { k: 'pre', op: c.v, a, line: c.line }; }
      if (c.v === '(' && this.peek().t === 'id' && TYPE_WORDS.has(this.peek().v)) {
        this.next(); const { type } = this.parseTypeWords(); this.expect(')');
        return { k: 'cast', type, a: this.parseUnary(), line: c.line };
      }
      if (c.v === '&' || c.v === '*') throw new CError('Pointers (& and *) are not supported.', c.line);
    }
    if (c.t === 'id' && c.v === 'sizeof') throw new CError('sizeof is not supported here.', c.line, 'Write the array length as a number or a const.');
    return this.parsePostfix();
  }
  parsePostfix() {
    let e = this.parsePrimary();
    for (;;) {
      const c = this.cur; if (c.t !== 'op') break;
      if (c.v === '[') { this.next(); const i = this.parseExpr(); this.expect(']'); e = { k: 'idx', a: e, i, line: c.line }; continue; }
      if (c.v === '(') {
        if (e.k !== 'var') throw new CError('Only functions can be called with ( ).', c.line, 'Is an operator like * missing before the ( ?');
        this.next(); e = { k: 'call', name: e.name, args: this.parseArgs(), line: e.line }; continue;
      }
      if (c.v === '.') {
        this.next(); const m = this.next();
        if (m.t !== 'id') throw new CError('A name is expected after the dot.', m.line);
        if (!this.isOp('(')) throw new CError(`.${m.v} needs ( ) after it.`, m.line, `Write .${m.v}()`);
        this.next(); e = { k: 'mcall', obj: e, name: m.v, args: this.parseArgs(), line: m.line }; continue;
      }
      if (c.v === '++' || c.v === '--') { if (!isLvalue(e)) throw new CError(`${c.v} only works on a variable.`, c.line); this.next(); e = { k: 'post', op: c.v, a: e, line: c.line }; continue; }
      if (c.v === '->' || c.v === '::') throw new CError(`"${c.v}" is not supported in this simulator.`, c.line);
      break;
    }
    return e;
  }
  parseArgs() {
    const args = [];
    if (this.accept(')')) return args;
    for (;;) { args.push(this.parseAssign()); if (this.accept(',')) continue; this.expect(')'); break; }
    return args;
  }
  parsePrimary() {
    const c = this.next();
    switch (c.t) {
      case 'num': return { k: 'num', v: c.v, type: numType(c), line: c.line };
      case 'char': return { k: 'num', v: c.v, type: 'char', line: c.line };
      case 'str': { let s = c.v; while (this.cur.t === 'str') s += this.next().v; return { k: 'str', v: s, line: c.line }; }
      case 'id':
        if (KEYWORDS.has(c.v)) throw new CError(`"${c.v}" can't be used here.`, c.line, c.v === 'else' ? 'Is there a ; or } missing before else?' : '');
        return { k: 'var', name: c.v, line: c.line };
      case 'op': if (c.v === '(') { const e = this.parseExpr(); this.expect(')'); return e; } break;
      case 'eof': throw new CError('The program ends too early — something is missing.', c.line, 'Check for a missing } or ).');
    }
    throw new CError(`Unexpected ${desc(c)}.`, c.line, c.v === ')' ? 'There is an extra ) or something missing before it.' : c.v === '}' ? 'Is a ; missing on the line before?' : '');
  }
}
function numType(tk) {
  if (tk.isFloat) return 'float';
  const v = tk.v;
  if (tk.suf.includes('l')) return tk.suf.includes('u') ? 'uint32' : 'int32';
  if (tk.suf.includes('u')) return v <= 65535 ? 'uint16' : 'uint32';
  if (v <= 32767) return 'int16';
  if (v <= 2147483647) return 'int32';
  return 'uint32';
}

/* ---------------- built-in library ---------------- */
const CONSTS = {
  HIGH: [1, 'int16'], LOW: [0, 'int16'], INPUT: [0, 'int16'], OUTPUT: [1, 'int16'], INPUT_PULLUP: [2, 'int16'],
  LED_BUILTIN: [13, 'int16'], true: [1, 'bool'], false: [0, 'bool'], NULL: [0, 'int16'],
  A0: [14, 'int16'], A1: [15, 'int16'], A2: [16, 'int16'], A3: [17, 'int16'], A4: [18, 'int16'], A5: [19, 'int16'], A6: [20, 'int16'], A7: [21, 'int16'],
  PI: [Math.PI, 'float'], HALF_PI: [Math.PI / 2, 'float'], TWO_PI: [Math.PI * 2, 'float'], DEG_TO_RAD: [Math.PI / 180, 'float'], RAD_TO_DEG: [180 / Math.PI, 'float'],
  DEC: [10, 'int16'], HEX: [16, 'int16'], OCT: [8, 'int16'], BIN: [2, 'int16'],
};
const fl = f => ({ ret: 'float', make: () => f });
const BUILTINS = {
  pinMode: { n: [2, 2], ret: 'void', a: 'a pin and a mode', ex: 'pinMode(13, OUTPUT);', make: rt => (p, m) => rt.pinMode(p, m) },
  digitalWrite: { n: [2, 2], ret: 'void', a: 'a pin and HIGH or LOW', ex: 'digitalWrite(13, HIGH);', cost: 0.004, make: rt => (p, v) => rt.digitalWrite(p, v) },
  digitalRead: { n: [1, 1], ret: 'int16', a: 'a pin', ex: 'int b = digitalRead(2);', cost: 0.004, make: rt => p => rt.digitalRead(p) },
  analogRead: { n: [1, 1], ret: 'int16', a: 'an analog pin', ex: 'int v = analogRead(A0);', cost: 0.112, make: rt => p => rt.analogRead(p) },
  analogWrite: { n: [2, 2], ret: 'void', a: 'a PWM pin and a value 0–255', ex: 'analogWrite(5, 200);', cost: 0.006, make: rt => (p, v) => rt.analogWrite(p, v) },
  delay: { n: [1, 1], ret: 'void', a: 'a time in milliseconds', ex: 'delay(1000);', make: rt => ms => rt.delay(ms) },
  delayMicroseconds: { n: [1, 1], ret: 'void', a: 'a time in microseconds', ex: 'delayMicroseconds(10);', make: rt => us => rt.delayUs(us) },
  millis: { n: [0, 0], ret: 'uint32', a: 'no values', ex: 'unsigned long t = millis();', make: rt => () => rt.millis() },
  micros: { n: [0, 0], ret: 'uint32', a: 'no values', ex: 'unsigned long t = micros();', make: rt => () => rt.micros() },
  pulseIn: { n: [2, 3], ret: 'uint32', a: 'a pin, HIGH or LOW, and an optional timeout', ex: 'long t = pulseIn(ECHO, HIGH);', make: rt => (p, s, to) => rt.pulseIn(p, s, to) },
  tone: { n: [2, 3], ret: 'void', a: 'a pin, a frequency and an optional duration', ex: 'tone(4, 440, 200);', make: rt => (p, f, d) => rt.tone(p, f, d) },
  noTone: { n: [1, 1], ret: 'void', a: 'a pin', ex: 'noTone(4);', make: rt => p => rt.tone(p, 0, 0) },
  map: { n: [5, 5], ret: 'int32', a: 'value, fromLow, fromHigh, toLow, toHigh', ex: 'int s = map(v, 0, 1023, 0, 255);', make: (rt, ty, line) => (x, a, b, c, d) => {
    x = Math.trunc(x); a = Math.trunc(a); b = Math.trunc(b); c = Math.trunc(c); d = Math.trunc(d);
    if (a === b) throw new RTError('map() was given the same fromLow and fromHigh, so it divides by zero.', line);
    return Math.trunc((x - a) * (d - c) / (b - a)) + c; } },
  constrain: { n: [3, 3], ret: 'gen', a: 'value, low, high', ex: 'x = constrain(x, -255, 255);', make: () => (x, a, b) => (x < a ? a : x > b ? b : x) },
  abs: { n: [1, 1], ret: 'gen', a: 'one number', ex: 'abs(-5)', make: () => x => Math.abs(x) },
  min: { n: [2, 2], ret: 'gen', a: 'two numbers', ex: 'min(a, b)', make: () => (a, b) => Math.min(a, b) },
  max: { n: [2, 2], ret: 'gen', a: 'two numbers', ex: 'max(a, b)', make: () => (a, b) => Math.max(a, b) },
  sq: { n: [1, 1], ret: 'gen', a: 'one number', ex: 'sq(x)', make: () => x => x * x },
  sqrt: { n: [1, 1], a: 'one number', ex: 'sqrt(x)', ...fl(Math.sqrt) },
  pow: { n: [2, 2], a: 'base and exponent', ex: 'pow(2, 3)', ...fl(Math.pow) },
  sin: { n: [1, 1], a: 'an angle in radians', ex: 'sin(x)', ...fl(Math.sin) },
  cos: { n: [1, 1], a: 'an angle in radians', ex: 'cos(x)', ...fl(Math.cos) },
  tan: { n: [1, 1], a: 'an angle in radians', ex: 'tan(x)', ...fl(Math.tan) },
  atan: { n: [1, 1], a: 'one number', ex: 'atan(x)', ...fl(Math.atan) },
  atan2: { n: [2, 2], a: 'y and x', ex: 'atan2(y, x)', ...fl(Math.atan2) },
  exp: { n: [1, 1], a: 'one number', ex: 'exp(x)', ...fl(Math.exp) },
  log: { n: [1, 1], a: 'one number', ex: 'log(x)', ...fl(Math.log) },
  fabs: { n: [1, 1], a: 'one number', ex: 'fabs(x)', ...fl(Math.abs) },
  floor: { n: [1, 1], a: 'one number', ex: 'floor(x)', ...fl(Math.floor) },
  ceil: { n: [1, 1], a: 'one number', ex: 'ceil(x)', ...fl(Math.ceil) },
  round: { n: [1, 1], ret: 'int32', a: 'one number', ex: 'round(x)', make: () => x => (x < 0 ? -Math.round(-x) : Math.round(x)) },
  isnan: { n: [1, 1], ret: 'bool', a: 'one number', ex: 'isnan(x)', make: () => x => (Number.isNaN(x) ? 1 : 0) },
  random: { n: [1, 2], ret: 'int32', a: 'max, or min and max', ex: 'random(0, 100)', make: rt => (a, b) => (b === undefined ? Math.floor(rt.rand() * a) : a + Math.floor(rt.rand() * (b - a))) },
  randomSeed: { n: [1, 1], ret: 'void', a: 'a number', ex: 'randomSeed(analogRead(A5));', make: rt => s => rt.seed(s) },
  String: { n: [1, 2], ret: 'string', a: 'a value and optional decimals', ex: 'String(42)', make: (rt, ty) => (x, d) => fmtNum(x, ty[0], d) },
  bitRead: { n: [2, 2], ret: 'int16', a: 'value and bit number', ex: 'bitRead(x, 0)', make: () => (x, b) => (x >> b) & 1 },
};
const SERIAL = {
  begin: { n: [1, 2], ret: 'void', make: rt => b => rt.serialBegin(b) },
  end: { n: [0, 0], ret: 'void', make: () => () => 0 },
  print: { n: [1, 2], ret: 'uint16', make: (rt, ty) => (x, d) => rt.serialOut(fmtNum(x, ty[0], d)) },
  println: { n: [0, 2], ret: 'uint16', make: (rt, ty) => (x, d) => rt.serialOut((ty.length ? fmtNum(x, ty[0], d) : '') + '\n') },
  write: { n: [1, 1], ret: 'uint16', make: (rt, ty) => x => rt.serialOut(ty[0] === 'string' ? x : String.fromCharCode(x & 255)) },
  available: { n: [0, 0], ret: 'int16', make: rt => () => rt.rx.length },
  read: { n: [0, 0], ret: 'int16', make: rt => () => (rt.rx.length ? rt.rx.shift() : -1) },
  peek: { n: [0, 0], ret: 'int16', make: rt => () => (rt.rx.length ? rt.rx[0] : -1) },
  parseInt: { n: [0, 0], ret: 'int32', make: rt => () => rt.parseNum(false) },
  parseFloat: { n: [0, 0], ret: 'float', make: rt => () => rt.parseNum(true) },
  readString: { n: [0, 0], ret: 'string', make: rt => () => { const s = String.fromCharCode(...rt.rx); rt.rx.length = 0; return s; } },
  readStringUntil: { n: [1, 1], ret: 'string', make: rt => ch => { let s = ''; while (rt.rx.length) { const c = rt.rx.shift(); if (c === ch) break; s += String.fromCharCode(c); } return s; } },
  flush: { n: [0, 0], ret: 'void', make: () => () => 0 },
  setTimeout: { n: [1, 1], ret: 'void', make: () => () => 0 },
};
const STRING_METHODS = {
  length: { n: [0, 0], ret: 'int16', f: s => s.length },
  toInt: { n: [0, 0], ret: 'int32', f: s => parseInt(s, 10) || 0 },
  toFloat: { n: [0, 0], ret: 'float', f: s => parseFloat(s) || 0 },
  charAt: { n: [1, 1], ret: 'char', f: (s, i) => s.charCodeAt(i) || 0 },
  indexOf: { n: [1, 1], ret: 'int16', f: (s, x) => s.indexOf(typeof x === 'number' ? String.fromCharCode(x) : x) },
  substring: { n: [1, 2], ret: 'string', f: (s, a, b) => s.substring(a, b) },
  equals: { n: [1, 1], ret: 'bool', f: (s, x) => (s === x ? 1 : 0) },
  startsWith: { n: [1, 1], ret: 'bool', f: (s, x) => (s.startsWith(x) ? 1 : 0) },
  endsWith: { n: [1, 1], ret: 'bool', f: (s, x) => (s.endsWith(x) ? 1 : 0) },
};

/* ---------------- compiler: AST -> closures ---------------- */
const BRK = { brk: 1 }, CNT = { cnt: 1 }, RET0 = { r: true, v: 0 };
function gen(e) { if (e.g) return e.g; const s = e.s; return function* (L) { return s(L); }; }
function mk(kids, f) {
  if (kids.every(k => k.s)) {
    const n = kids.length;
    if (n === 0) return { s: L => f(L) };
    if (n === 1) { const a = kids[0].s; return { s: L => f(L, a(L)) }; }
    if (n === 2) { const a = kids[0].s, b = kids[1].s; return { s: L => f(L, a(L), b(L)) }; }
    if (n === 3) { const a = kids[0].s, b = kids[1].s, c = kids[2].s; return { s: L => f(L, a(L), b(L), c(L)) }; }
    const ss = kids.map(k => k.s); return { s: L => f(L, ...ss.map(s => s(L))) };
  }
  const gs = kids.map(gen);
  return { g: function* (L) { const v = new Array(gs.length); for (let i = 0; i < gs.length; i++) v[i] = yield* gs[i](L); return f(L, ...v); } };
}
function binop(op, t, line) {
  const w = WRAP[t], isInt = t !== 'float';
  const dz = () => { throw new RTError('Division by zero!', line, 'Make sure the number after / or % is never 0.'); };
  switch (op) {
    case '+': return isInt ? (x, y) => w(x + y) : (x, y) => x + y;
    case '-': return isInt ? (x, y) => w(x - y) : (x, y) => x - y;
    case '*': return isInt ? (x, y) => w(mul32(x, y)) : (x, y) => x * y;
    case '/': return isInt ? (x, y) => (y === 0 ? dz() : w(Math.trunc(x / y))) : (x, y) => x / y;
    case '%': return isInt ? (x, y) => (y === 0 ? dz() : w(x % y)) : (x, y) => x % y;
    case '<<': return (x, y) => w(Math.trunc(x) << y);
    case '>>': return (t === 'uint16' || t === 'uint32') ? (x, y) => w(x >>> y) : (x, y) => w(x >> y);
    case '&': return (x, y) => w(x & y);
    case '|': return (x, y) => w(x | y);
    case '^': return (x, y) => w(x ^ y);
    case '==': return (x, y) => (x === y ? 1 : 0);
    case '!=': return (x, y) => (x !== y ? 1 : 0);
    case '<': return (x, y) => (x < y ? 1 : 0);
    case '>': return (x, y) => (x > y ? 1 : 0);
    case '<=': return (x, y) => (x <= y ? 1 : 0);
    case '>=': return (x, y) => (x >= y ? 1 : 0);
  }
  throw new CError(`Unknown operator ${op}.`, line);
}
// Fast exact 32-bit multiply for the integer path.
function mul32(x, y) { const a = Math.trunc(x), b = Math.trunc(y); const p = a * b; return Number.isSafeInteger(p) ? p : Number(BigInt.asIntN(32, BigInt(a) * BigInt(b))); }
function newArray(type, n) {
  switch (type) {
    case 'int8': case 'char': return new Int8Array(n);
    case 'uint8': case 'bool': return new Uint8Array(n);
    case 'int16': return new Int16Array(n);
    case 'uint16': return new Uint16Array(n);
    case 'int32': return new Int32Array(n);
    case 'uint32': return new Uint32Array(n);
    case 'float': return new Float32Array(n);
    default: return new Array(n).fill('');
  }
}

class Compiler {
  constructor(prog, rt) { this.prog = prog; this.rt = rt; this.G = []; this.gmap = new Map(); this.funcs = new Map(); this.fn = null; this.loopDepth = 0; this.switchDepth = 0; this.warnings = []; }
  warn(line, msg) { this.warnings.push({ line, msg }); }
  build() {
    const initG = [];
    for (const d of this.prog.globals) for (const dd of d.decls) {
      if (this.gmap.has(dd.name)) throw new CError(`"${dd.name}" is declared twice.`, dd.line);
      if (BUILTINS[dd.name] || CONSTS[dd.name]) throw new CError(`"${dd.name}" is already a built-in Arduino name. Pick another name.`, dd.line);
      const v = { slot: this.G.length, type: d.type, dims: dd.dims.length, global: true, isConst: d.isConst, name: dd.name, line: dd.line };
      this.G.push(0); this.gmap.set(dd.name, v);
      initG.push(this.declInit(v, dd, d.type));
    }
    for (const f of this.prog.funcs.values()) {
      if (BUILTINS[f.name]) throw new CError(`${f.name}() is already a built-in Arduino function. Pick another name.`, f.line);
      this.funcs.set(f.name, { def: f, name: f.name, ret: f.ret, params: f.params.map(p => ({ ...p })), body: null, nslots: 0 });
    }
    for (const F of this.funcs.values()) this.compileFunc(F);
    if (!this.funcs.has('setup')) throw new CError('Your program needs a void setup() { } function.', 1, 'setup() runs once when the robot turns on.');
    if (!this.funcs.has('loop')) throw new CError('Your program needs a void loop() { } function.', 1, 'loop() runs again and again, forever.');
    return { G: this.G, initG, funcs: this.funcs, globals: [...this.gmap.values()], warnings: this.warnings };
  }
  compileFunc(F) {
    this.fn = { n: 0, scopes: [new Map()], name: F.name, ret: F.ret };
    for (const p of F.params) { const v = this.declare(p.name, p.type, p.isArray ? 1 : 0, false, p.line); p.slot = v.slot; }
    const b = this.block(F.def.body.body);
    F.body = b.g; F.nslots = this.fn.n;
    this.fn = null;
  }
  pushScope() { if (this.fn) this.fn.scopes.push(new Map()); }
  popScope() { if (this.fn) this.fn.scopes.pop(); }
  declare(name, type, dims, isConst, line) {
    const sc = this.fn.scopes[this.fn.scopes.length - 1];
    if (sc.has(name)) throw new CError(`"${name}" is declared twice here.`, line);
    if (BUILTINS[name] || CONSTS[name]) throw new CError(`"${name}" is already a built-in Arduino name. Pick another name.`, line);
    const v = { slot: this.fn.n++, type, dims, isConst, name, global: false };
    sc.set(name, v);
    return v;
  }
  knownNames() { const s = new Set([...this.gmap.keys(), ...Object.keys(CONSTS)]); if (this.fn) for (const sc of this.fn.scopes) for (const k of sc.keys()) s.add(k); return [...s]; }
  lookup(name, line) {
    if (this.fn) for (let i = this.fn.scopes.length - 1; i >= 0; i--) { const v = this.fn.scopes[i].get(name); if (v) return v; }
    const g = this.gmap.get(name); if (g) return g;
    if (Object.prototype.hasOwnProperty.call(CONSTS, name)) return { constant: true, value: CONSTS[name][0], type: CONSTS[name][1] };
    if (this.funcs.has(name) || BUILTINS[name]) throw new CError(`${name} is a function — it needs ( ) after it.`, line, `Write ${name}( … )`);
    if (name === 'Serial') throw new CError('Serial needs a dot and a command, like Serial.println(x).', line);
    if (/^_{3,}$/.test(name)) throw new CError("This line still has a blank (____). Replace it with your answer.", line, 'The BLANK comment just above it says what goes there.');
    throw new CError(`"${name}" was not declared.`, line, suggest(name, this.knownNames()) || 'Create it first, for example: int ' + name + ' = 0;');
  }
  writer(v) {
    if (v.global) { const G = this.G, slot = v.slot; return (L, val) => (G[slot] = val); }
    const slot = v.slot; return (L, val) => (L[slot] = val);
  }
  declInit(v, d, type) {
    const write = this.writer(v);
    if (d.dims.length) {
      if (d.dims.length > 2) throw new CError('Only 1D and 2D arrays are supported.', d.line);
      const sizes = d.dims.map(de => { if (!de) return null; const e = this.ex(de); if (e.cv === undefined) throw new CError('The array size must be a fixed number (or a const).', d.line); return e.cv; });
      const inits = [];
      let init = d.init;
      if (init && init.k === 'str' && (type === 'char' || type === 'uint8')) init = { k: 'list', items: [...init.v].map(ch => ({ k: 'num', v: ch.charCodeAt(0), type: 'char' })).concat([{ k: 'num', v: 0, type: 'char' }]) };
      if (init && init.k !== 'list') throw new CError('An array needs a { } list of values.', d.line, `Example: int ${d.name}[3] = {1, 2, 3};`);
      if (sizes.length === 1) {
        if (sizes[0] === null) { if (!init) throw new CError(`The array ${d.name}[] needs a size.`, d.line); sizes[0] = init.items.length; }
        if (init) { if (init.items.length > sizes[0]) throw new CError(`Too many values for ${d.name}[${sizes[0]}].`, d.line); init.items.forEach((it, i) => inits.push([i, null, this.ex(it)])); }
      } else {
        if (sizes[1] === null) throw new CError('A 2D array needs its second size.', d.line);
        if (sizes[0] === null) { if (!init) throw new CError(`The array ${d.name} needs a size.`, d.line); sizes[0] = init.items.length; }
        if (init) init.items.forEach((row, i) => { if (row.k !== 'list') throw new CError('Each row of a 2D array needs its own { }.', d.line); row.items.forEach((it, j) => inits.push([i, j, this.ex(it)])); });
      }
      if (sizes.some(s => s <= 0 || s > 2000)) throw new CError(`The size of ${d.name} must be between 1 and 2000.`, d.line, 'An Arduino Uno only has 2 KB of memory!');
      const conv = WRAP[type];
      const ss = inits.map(x => [x[0], x[1], x[2].s || (() => { throw new CError('Array start values must be simple values.', d.line); })()]);
      const [n0, n1] = sizes;
      return { s: L => {
        const arr = n1 === undefined ? newArray(type, n0) : Array.from({ length: n0 }, () => newArray(type, n1));
        for (const [i, j, f] of ss) { if (j === null) arr[i] = conv(f(L)); else arr[i][j] = conv(f(L)); }
        write(L, arr);
      } };
    }
    if (!d.init) { const z = type === 'string' ? '' : 0; return { s: L => { write(L, z); } }; }
    if (d.init.k === 'list') throw new CError('A { } list can only be used for arrays.', d.line);
    const e = this.ex(d.init);
    if (e.dims) throw new CError('A whole array can\'t be copied into a variable.', d.line);
    if (type !== 'string' && e.type === 'string') throw new CError(`Text can't be stored in "${d.name}" because it is a number variable.`, d.line, 'Use String for text.');
    const conv = type === 'string' ? x => fmtNum(x, e.type) : WRAP[type];
    if (v.isConst && e.cv !== undefined) v.cv = conv(e.cv);
    if (type !== 'float' && type !== 'string' && e.type === 'float' && e.cv !== undefined && e.cv !== Math.trunc(e.cv))
      this.warn(d.line, `${d.name} is a whole-number type (${TNAME[type]}) so ${e.cv} becomes ${Math.trunc(e.cv)}. Use float for decimals.`);
    return mk([e], (L, x) => { write(L, conv(x)); });
  }
  ex(n) {
    switch (n.k) {
      case 'num': { const v = n.v; return { type: n.type, s: () => v, cv: v }; }
      case 'str': { const v = n.v; return { type: 'string', s: () => v }; }
      case 'var': {
        const v = this.lookup(n.name, n.line);
        if (v.constant) { const val = v.value; return { type: v.type, s: () => val, cv: val }; }
        if (v.cv !== undefined) { const val = v.cv; return { type: v.type, s: () => val, cv: val }; }
        const slot = v.slot;
        return { type: v.type, dims: v.dims, s: v.global ? ((G) => () => G[slot])(this.G) : L => L[slot] };
      }
      case 'idx': {
        const a = this.ex(n.a);
        if (!a.dims) throw new CError(`"${nameOf(n.a)}" is not an array, so [ ] can't be used on it.`, n.line);
        const i = this.ex(n.i), name = nameOf(n.a), line = n.line;
        return { type: a.type, dims: a.dims - 1, ...mk([a, i], (L, arr, k) => {
          k = Math.trunc(k);
          if (k < 0 || k >= arr.length) throw new RTError(`${name}[${k}] is outside the array. It has ${arr.length} boxes: ${name}[0] to ${name}[${arr.length - 1}].`, line, 'On a real Arduino this reads random memory and causes strange bugs!');
          return arr[k];
        }) };
      }
      case 'un': {
        const a = this.ex(n.a); this.noArr(a, n);
        if (n.op === '!') return { type: 'bool', ...mk([a], (L, x) => (x ? 0 : 1)), cv: a.cv !== undefined ? (a.cv ? 0 : 1) : undefined };
        const t = arith(a.type, 'int16'); const w = WRAP[t];
        if (t === 'string') throw new CError(`${n.op} can't be used on text.`, n.line);
        let f;
        if (n.op === '-') f = t === 'float' ? x => -x : x => w(-x);
        else if (n.op === '+') f = x => x;
        else f = x => w(~x);
        const r = { type: t, ...mk([a], (L, x) => f(x)) };
        if (a.cv !== undefined) { const v = f(a.cv); r.cv = v; r.s = () => v; delete r.g; }
        return r;
      }
      case 'bin': return this.bin(n);
      case 'assign': return this.assign(n);
      case 'pre': case 'post': return this.incdec(n);
      case 'cond': {
        const c = this.ex(n.c), a = this.ex(n.a), b = this.ex(n.b);
        const t = (a.type === 'string' || b.type === 'string') ? 'string' : arith(a.type, b.type);
        if (c.s && a.s && b.s) { const C = c.s, A = a.s, B = b.s; return { type: t, s: L => (C(L) ? A(L) : B(L)) }; }
        const C = gen(c), A = gen(a), B = gen(b);
        return { type: t, g: function* (L) { return (yield* C(L)) ? yield* A(L) : yield* B(L); } };
      }
      case 'comma': { const a = this.ex(n.a), b = this.ex(n.b); return { type: b.type, ...mk([a, b], (L, x, y) => y) }; }
      case 'cast': { const a = this.ex(n.a); this.noArr(a, n); const w = WRAP[n.type]; const r = { type: n.type, ...mk([a], (L, x) => w(x)) }; if (a.cv !== undefined) { r.cv = w(a.cv); } return r; }
      case 'call': return this.call(n);
      case 'mcall': return this.mcall(n);
      case 'list': throw new CError('A { } list can only be used when creating an array.', n.line);
    }
    throw new CError('This expression is not supported.', n.line);
  }
  noArr(e, n) { if (e.dims) throw new CError('An array needs [index] here, like name[0].', n.line); }
  bin(n) {
    const op = n.op;
    if (op === '&&' || op === '||') {
      const a = this.ex(n.a), b = this.ex(n.b);
      if (a.s && b.s) { const A = a.s, B = b.s; return { type: 'bool', s: op === '&&' ? L => (A(L) && B(L) ? 1 : 0) : L => (A(L) || B(L) ? 1 : 0) }; }
      const A = gen(a), B = gen(b);
      return { type: 'bool', g: op === '&&' ? function* (L) { return ((yield* A(L)) && (yield* B(L))) ? 1 : 0; } : function* (L) { return ((yield* A(L)) || (yield* B(L))) ? 1 : 0; } };
    }
    const a = this.ex(n.a), b = this.ex(n.b);
    this.noArr(a, n); this.noArr(b, n);
    const t = arith(a.type, b.type);
    if (t === 'string') {
      if (op === '+') { const ta = a.type, tb = b.type; return { type: 'string', ...mk([a, b], (L, x, y) => fmtNum(x, ta) + fmtNum(y, tb)) }; }
      if (op === '==' || op === '!=') { const eq = op === '=='; return { type: 'bool', ...mk([a, b], (L, x, y) => ((String(x) === String(y)) === eq ? 1 : 0)) }; }
      throw new CError('Text (String) can only be joined with + or compared with ==.', n.line);
    }
    let f = binop(op, t, n.line);
    const rtType = ['==', '!=', '<', '>', '<=', '>='].includes(op) ? 'bool' : (op === '<<' || op === '>>') ? arith(a.type, 'int16') : t;
    const r = { type: rtType, ...mk([a, b], (L, x, y) => f(x, y)) };
    if (a.cv !== undefined && b.cv !== undefined) {
      let v;
      try { v = f(a.cv, b.cv); } catch (e) { throw new CError(e.message, n.line); }
      if (t !== 'float' && op === '*' && v !== a.cv * b.cv)
        this.warn(n.line, `${a.cv} * ${b.cv} is too big for an Arduino int (max 32767) and becomes ${v}. Write ${a.cv}L * ${b.cv} to use a long.`);
      r.cv = v; r.s = () => v; delete r.g;
    }
    return r;
  }
  lval(n) {
    if (n.k === 'var') {
      const v = this.lookup(n.name, n.line);
      if (v.constant) throw new CError(`"${n.name}" is a built-in constant and can't be changed.`, n.line);
      if (v.isConst) throw new CError(`"${n.name}" is const, so it can't be changed.`, n.line, 'Remove the word const if it needs to change.');
      if (v.dims) throw new CError(`A whole array can't be set at once. Set one box, like ${n.name}[0] = …`, n.line);
      const slot = v.slot;
      if (v.global) { const G = this.G; return { type: v.type, rd: () => G[slot], wr: (L, val) => (G[slot] = val) }; }
      return { type: v.type, rd: L => L[slot], wr: (L, val) => (L[slot] = val) };
    }
    const a = this.ex(n.a);
    if (!a.dims) throw new CError(`"${nameOf(n.a)}" is not an array.`, n.line);
    if (a.dims !== 1) throw new CError(`${nameOf(n.a)} is a 2D array — use two indexes like ${nameOf(n.a)}[i][j].`, n.line);
    const i = this.ex(n.i);
    if (!a.s || !i.s) throw new CError('This array index is too complicated. Store it in a variable first.', n.line);
    const A = a.s, I = i.s, line = n.line, name = nameOf(n.a);
    return { type: a.type, ref: L => {
      const arr = A(L), k = Math.trunc(I(L));
      if (k < 0 || k >= arr.length) throw new RTError(`${name}[${k}] is outside the array. It has ${arr.length} boxes: ${name}[0] to ${name}[${arr.length - 1}].`, line, 'On a real Arduino this overwrites other memory!');
      return [arr, k];
    } };
  }
  assign(n) {
    const lv = this.lval(n.a), b = this.ex(n.b), t = lv.type;
    this.noArr(b, n);
    if (t !== 'string' && b.type === 'string') throw new CError('Text can\'t be stored in a number variable.', n.line, 'Use a String variable for text.');
    let combine = null;
    if (n.op !== '=') {
      const op = n.op.slice(0, -1), at = arith(t, b.type);
      if (at === 'string') { if (op !== '+') throw new CError(`${n.op} doesn't work on text.`, n.line); const tb = b.type; combine = (x, y) => x + fmtNum(y, tb); }
      else combine = binop(op, at, n.line);
    }
    const tb = b.type;
    const conv = t === 'string' ? x => fmtNum(x, tb) : WRAP[t];
    if (lv.rd) {
      const rd = lv.rd, wr = lv.wr;
      return { type: t, ...mk([b], combine ? (L, y) => wr(L, conv(combine(rd(L), y))) : (L, y) => wr(L, conv(y))) };
    }
    const ref = lv.ref;
    return { type: t, ...mk([b], combine
      ? (L, y) => { const [arr, k] = ref(L); arr[k] = conv(combine(arr[k], y)); return arr[k]; }
      : (L, y) => { const [arr, k] = ref(L); arr[k] = conv(y); return arr[k]; }) };
  }
  incdec(n) {
    const lv = this.lval(n.a), d = n.op === '++' ? 1 : -1, w = WRAP[lv.type], post = n.k === 'post';
    if (lv.type === 'string') throw new CError(`${n.op} doesn't work on text.`, n.line);
    if (lv.rd) {
      const rd = lv.rd, wr = lv.wr;
      return { type: lv.type, s: post ? L => { const o = rd(L); wr(L, w(o + d)); return o; } : L => wr(L, w(rd(L) + d)) };
    }
    const ref = lv.ref;
    return { type: lv.type, s: post ? L => { const [a, k] = ref(L); const o = a[k]; a[k] = w(o + d); return o; } : L => { const [a, k] = ref(L); a[k] = w(a[k] + d); return a[k]; } };
  }
  call(n) {
    const name = n.name;
    if (this.funcs.has(name)) return this.userCall(n);
    if (TYPE_WORDS.has(name)) {
      const t = canonType([name], n.line);
      if (t === 'string') return this.builtinCall(n, BUILTINS.String);
      if (n.args.length !== 1) throw new CError(`${name}( ) needs exactly one value.`, n.line);
      const a = this.ex(n.args[0]); const w = WRAP[t];
      return { type: t, ...mk([a], (L, x) => w(x)) };
    }
    const B = BUILTINS[name];
    if (!B) {
      if (name === 'serial' || name === 'print' || name === 'println') throw new CError(`"${name}()" doesn't exist.`, n.line, 'To print, write Serial.println(value);');
      throw new CError(`The function "${name}()" doesn't exist.`, n.line, suggest(name, [...Object.keys(BUILTINS), ...this.funcs.keys()]) || 'Check the spelling, or write this function yourself.');
    }
    return this.builtinCall(n, B);
  }
  builtinCall(n, B) {
    const name = n.name;
    if (n.args.length < B.n[0] || n.args.length > B.n[1]) throw new CError(`${name}() needs ${B.a}.`, n.line, `Example: ${B.ex}`);
    const args = n.args.map(a => this.ex(a));
    args.forEach(a => this.noArr(a, n));
    const types = args.map(a => a.type);
    if (name !== 'String' && types.includes('string')) throw new CError(`${name}() needs numbers, not text.`, n.line);
    let ret = B.ret === 'gen' ? types.reduce((t, x) => arith(t, x), 'int16') : B.ret;
    const impl = B.make(this.rt, types, n.line);
    const rt = this.rt, cost = B.cost || 0.002;
    if (name === 'delay' && args[0].cv !== undefined && args[0].cv < 0) this.warn(n.line, 'delay() with a negative number waits about 49 days on a real Arduino!');
    if (name === 'analogWrite' && args[0].cv !== undefined && !PWM_PINS.has(args[0].cv)) this.warn(n.line, `Pin ${args[0].cv} can't do analogWrite on an Uno. PWM pins are 3, 5, 6, 9, 10 and 11.`);
    return { type: ret, ...mk(args, (L, ...v) => { rt.cost += cost; return impl(...v); }) };
  }
  userCall(n) {
    const F = this.funcs.get(n.name), ps = F.params;
    if (n.args.length !== ps.length) throw new CError(`${n.name}() needs ${ps.length} value${ps.length === 1 ? '' : 's'} but got ${n.args.length}.`, n.line, `It was written as ${n.name}(${ps.map(p => TNAME[p.type] + ' ' + p.name + (p.isArray ? '[]' : '')).join(', ')}).`);
    const args = n.args.map(a => this.ex(a));
    args.forEach((a, i) => {
      if (ps[i].isArray && !a.dims) throw new CError(`Input ${i + 1} of ${n.name}() must be an array.`, n.line);
      if (!ps[i].isArray && a.dims) throw new CError(`Input ${i + 1} of ${n.name}() is a single value, not an array.`, n.line);
      if (ps[i].type !== 'string' && a.type === 'string') throw new CError(`Input ${i + 1} of ${n.name}() must be a number, not text.`, n.line);
    });
    const gs = args.map(gen), rt = this.rt;
    return { type: F.ret, g: function* (L) {
      const v = new Array(gs.length);
      for (let i = 0; i < gs.length; i++) v[i] = yield* gs[i](L);
      return yield* rt.invoke(F, v);
    } };
  }
  mcall(n) {
    if (n.obj.k === 'var' && /^Serial\d?$/.test(n.obj.name)) {
      const M = SERIAL[n.name];
      if (!M) throw new CError(`Serial.${n.name}() doesn't exist.`, n.line, suggest(n.name, Object.keys(SERIAL)));
      if (n.args.length < M.n[0] || n.args.length > M.n[1]) throw new CError(`Serial.${n.name}() was given the wrong number of values.`, n.line);
      const args = n.args.map(a => this.ex(a));
      args.forEach(a => this.noArr(a, n));
      const impl = M.make(this.rt, args.map(a => a.type), n.line);
      return { type: M.ret, ...mk(args, (L, ...v) => impl(...v)) };
    }
    if (n.obj.k === 'var' && /^serial$/i.test(n.obj.name)) throw new CError(`"${n.obj.name}" should be Serial with a capital S.`, n.line);
    const o = this.ex(n.obj);
    if (o.type !== 'string') throw new CError(`.${n.name}() only works on Serial or on a String.`, n.line);
    const M = STRING_METHODS[n.name];
    if (!M) throw new CError(`Strings don't have .${n.name}().`, n.line, suggest(n.name, Object.keys(STRING_METHODS)));
    const args = n.args.map(a => this.ex(a)); const f = M.f;
    return { type: M.ret, ...mk([o, ...args], (L, s, ...v) => f(String(s), ...v)) };
  }
  sub(n, isLoop) {
    if (isLoop) this.loopDepth++;
    this.pushScope();
    const r = n.k === 'block' ? this.block(n.body) : this.stmt(n);
    this.popScope();
    if (isLoop) this.loopDepth--;
    return r;
  }
  block(stmts) {
    this.pushScope();
    const cs = stmts.map(s => this.stmt(s));
    this.popScope();
    const rt = this.rt, n = cs.length;
    return { g: function* (L) {
      for (let i = 0; i < n; i++) {
        const c = cs[i]; rt.line = c.line;
        const sig = c.s ? c.s(L) : yield* c.g(L);
        rt.cost += STMT_COST;
        if (sig) return sig;
        if (rt.cost >= SLICE) yield 0;
      }
    } };
  }
  condWarn(e) {
    if (e.k === 'assign' && e.op === '=') this.warn(e.line, 'This if/while uses = (which SETS a value). To compare, use == .');
  }
  stmt(n) {
    const rt = this.rt, line = n.line;
    switch (n.k) {
      case 'empty': return { line, s: () => undefined };
      case 'expr': {
        if (n.e.k === 'bin' && ['==', '!=', '<', '>', '<=', '>='].includes(n.e.op)) this.warn(line, `This line compares with ${n.e.op} but doesn't use the result. To set a value, use = .`);
        if (n.e.k === 'var') this.warn(line, `"${n.e.name}" on its own does nothing. If it is a function, add ( ).`);
        const e = this.ex(n.e);
        if (e.s) { const s = e.s; return { line, s: L => { s(L); } }; }
        const g = e.g; return { line, g: function* (L) { yield* g(L); } };
      }
      case 'decl': {
        if (!this.fn) throw new CError('Unexpected declaration.', line);
        const parts = [];
        for (const d of n.decls) { const p = this.declInitLocal(n, d); parts.push(p); }
        if (parts.every(p => p.s)) { const ss = parts.map(p => p.s); return { line, s: L => { for (const s of ss) s(L); } }; }
        const gs = parts.map(gen); return { line, g: function* (L) { for (const g of gs) yield* g(L); } };
      }
      case 'block': { const b = this.block(n.body); return { line, g: b.g }; }
      case 'if': {
        this.condWarn(n.c);
        const c = this.ex(n.c); this.noArr(c, n);
        const T = this.sub(n.t), F = n.f ? this.sub(n.f) : null;
        const cs = c.s, C = gen(c);
        return { line, g: function* (L) {
          const v = cs ? cs(L) : yield* C(L);
          if (v) return T.s ? T.s(L) : yield* T.g(L);
          if (F) return F.s ? F.s(L) : yield* F.g(L);
        } };
      }
      case 'while': case 'do': {
        this.condWarn(n.c);
        const c = this.ex(n.c), b = this.sub(n.b, true), cs = c.s, C = gen(c), isDo = n.k === 'do';
        return { line, g: function* (L) {
          let first = isDo;
          for (;;) {
            if (!first) { const v = cs ? cs(L) : yield* C(L); if (!v) return; }
            first = false;
            rt.cost += LOOP_COST;
            const sig = b.s ? b.s(L) : yield* b.g(L);
            if (sig === BRK) return;
            if (sig && sig !== CNT) return sig;
            if (rt.cost >= SLICE) yield 0;
          }
        } };
      }
      case 'for': {
        this.pushScope();
        const init = n.init ? this.stmt(n.init) : null;
        const c = n.c ? this.ex(n.c) : null, step = n.step ? this.ex(n.step) : null;
        const b = this.sub(n.b, true);
        this.popScope();
        const cs = c && c.s, C = c && gen(c), ss = step && step.s, S = step && gen(step);
        return { line, g: function* (L) {
          if (init) { if (init.s) init.s(L); else yield* init.g(L); }
          for (;;) {
            if (c) { const v = cs ? cs(L) : yield* C(L); if (!v) return; }
            rt.cost += LOOP_COST;
            const sig = b.s ? b.s(L) : yield* b.g(L);
            if (sig === BRK) return;
            if (sig && sig !== CNT) return sig;
            if (step) { if (ss) ss(L); else yield* S(L); }
            if (rt.cost >= SLICE) yield 0;
          }
        } };
      }
      case 'switch': {
        const e = this.ex(n.e); this.noArr(e, n);
        const table = new Map(); let def = -1;
        for (const l of n.labels) {
          if (l.v === null) { def = l.at; continue; }
          const lv = this.ex(l.v);
          if (lv.cv === undefined) throw new CError('A case needs a fixed value, like 3 or \'F\'.', l.line);
          if (table.has(lv.cv)) throw new CError(`case ${lv.cv} appears twice.`, l.line);
          table.set(lv.cv, l.at);
        }
        this.switchDepth++; this.pushScope();
        const cs = n.body.map(s => this.stmt(s));
        this.popScope(); this.switchDepth--;
        const es = e.s, E = gen(e);
        return { line, g: function* (L) {
          const v = es ? es(L) : yield* E(L);
          const start = table.has(v) ? table.get(v) : def;
          if (start < 0) return;
          for (let i = start; i < cs.length; i++) {
            const c = cs[i]; rt.line = c.line;
            const sig = c.s ? c.s(L) : yield* c.g(L);
            rt.cost += STMT_COST;
            if (sig === BRK) return;
            if (sig) return sig;
            if (rt.cost >= SLICE) yield 0;
          }
        } };
      }
      case 'break':
        if (!this.loopDepth && !this.switchDepth) throw new CError('break can only be used inside a loop or a switch.', line, 'To leave loop() early, use return;');
        return { line, s: () => BRK };
      case 'continue':
        if (!this.loopDepth) throw new CError('continue can only be used inside a loop.', line);
        return { line, s: () => CNT };
      case 'return': {
        const F = this.fn;
        if (n.e) {
          if (F.ret === 'void') throw new CError(`${F.name}() is void, so it can't return a value.`, line, 'Change void to int (or float) if it should give back a number.');
          const e = this.ex(n.e); this.noArr(e, n);
          if (e.s) { const s = e.s; return { line, s: L => ({ r: true, v: s(L) }) }; }
          const g = e.g; return { line, g: function* (L) { return { r: true, v: yield* g(L) }; } };
        }
        return { line, s: () => RET0 };
      }
    }
    throw new CError('This statement is not supported.', line);
  }
  declInitLocal(n, d) {
    // Compile the initializer before declaring, so "int x = x;" refers to an outer x like C would warn about.
    const v = this.declare(d.name, n.type, d.dims.length, n.isConst, d.line);
    return this.declInit(v, d, n.type);
  }
}

function compileArduino(src, rt) {
  const info = { includes: [] };
  const toks = preprocess(tokenize(src), info);
  const prog = new Parser(toks).parseProgram();
  const out = new Compiler(prog, rt).build();
  out.includes = info.includes;
  for (const inc of info.includes) {
    const lib = inc.replace(/[<>"]/g, '');
    if (!/^(Arduino\.h|math\.h|stdlib\.h)$/.test(lib)) out.warnings.push({ line: 1, msg: `#include ${inc}: this library is not simulated. Built-in Arduino functions still work.` });
  }
  return out;
}
