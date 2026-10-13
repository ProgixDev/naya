#!/usr/bin/env node
/**
 * Generates docs/architecture/api-reference.md from the Hono route registrations in services/demo-api/src.
 *
 *   node scripts/docs/gen-api-reference.mjs            write the file
 *   node scripts/docs/gen-api-reference.mjs --check    exit 1 when the committed file is stale (for CI)
 *   node scripts/docs/gen-api-reference.mjs --stdout   print the markdown instead of writing it
 *
 * It reads code patterns with the TypeScript parser, not types. A route's facts come from its handler and every
 * function the handler calls that is defined in services/demo-api/src (followed through relative imports):
 * userOf / adminOf / c.get('principal') → caller, requirePermission → permission, idempotent() → Idempotency-Key,
 * body(c, schema) and <name>Schema.parse(…) → validated input, ctx.config.devMode → dev-mode notes.
 * A new auth or validation helper must be taught here (see INTRINSICS), or its routes will look public.
 */
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_DIR = join(ROOT, 'services', 'demo-api');
const SRC = join(API_DIR, 'src');
const DOMAIN_SRC = join(ROOT, 'packages', 'domain', 'src');
const OUT = join(ROOT, 'docs', 'architecture', 'api-reference.md');
const SCRIPT = 'scripts/docs/gen-api-reference.mjs';
// TypeScript is a declared devDependency of @naya/demo-api: resolve it from there rather than from the hoisted root.
const ts = createRequire(join(API_DIR, 'package.json'))('typescript');

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all']);
/** Names handled as facts instead of being followed into their bodies. */
const INTRINSICS = new Set(['userOf', 'adminOf', 'requirePermission', 'idempotent', 'body', 'verifySignature']);

/* ───────── Source loading ───────── */

const posix = (p) => p.split(sep).join('/');
const rel = (abs) => posix(relative(ROOT, abs));

function tsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const files = new Map(); // abs path → { sf, defs, imports }
function load(abs) {
  if (files.has(abs)) return files.get(abs);
  const sf = ts.createSourceFile(abs, readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const entry = { sf, defs: new Map(), imports: new Map() };
  files.set(abs, entry);
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && !entry.defs.has(n.name.text)) entry.defs.set(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) && !entry.defs.has(n.name.text)) {
      entry.defs.set(n.name.text, n.initializer);
    }
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.startsWith('.')) {
      const base = resolve(dirname(abs), n.moduleSpecifier.text);
      const target = [`${base}.ts`, join(base, 'index.ts')].find(existsSync);
      const named = n.importClause?.namedBindings;
      if (target && named && ts.isNamedImports(named)) {
        for (const el of named.elements) entry.imports.set(el.name.text, { file: target, name: (el.propertyName ?? el.name).text });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return entry;
}

const line = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const str = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

function resolveDef(abs, name) {
  const f = load(abs);
  if (f.defs.has(name)) return { abs, node: f.defs.get(name) };
  const imp = f.imports.get(name);
  if (imp) {
    const t = load(imp.file);
    if (t.defs.has(imp.name)) return { abs: imp.file, node: t.defs.get(imp.name) };
  }
  return null;
}

/* ───────── Domain facts: permission list and permission helpers ───────── */

function adminPermissions() {
  const sf = load(join(DOMAIN_SRC, 'entities.ts')).sf;
  let perms = [];
  const visit = (n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'AdminPermission' && ts.isUnionTypeNode(n.type)) {
      perms = n.type.types.filter((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)).map((t) => t.literal.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return perms;
}

/** Exported @naya/domain helpers that grant access when the admin holds any of several permissions. */
function permissionHelpers() {
  const helpers = new Map();
  for (const abs of tsFiles(DOMAIN_SRC)) {
    for (const [name, node] of load(abs).defs) {
      const found = new Set();
      const visit = (n) => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'includes' && /permissions$/.test(n.expression.expression.getText())) {
          const p = str(n.arguments[0]);
          if (p) found.add(p);
        }
        ts.forEachChild(n, visit);
      };
      visit(node);
      if (found.size > 1) helpers.set(name, { name, perms: [...found] });
    }
  }
  return helpers;
}

const PERMISSIONS = adminPermissions();
const HELPERS = permissionHelpers();

/* ───────── Route facts ───────── */

function newFacts() {
  return { roles: new Set(), perms: new Set(), anyOf: new Map(), inline: new Set(), idem: new Set(), schemas: new Set(), rawJson: false, query: new Set(), principal: false, userOnly: false, signature: false, devRefs: false, dev403: false };
}

const isReq = (n) => ts.isPropertyAccessExpression(n) && n.name.text === 'req';
const reqCall = (n, method) => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === method && isReq(n.expression.expression);
const unwrap = (n) => { while (n && (ts.isAwaitExpression(n) || ts.isParenthesizedExpression(n) || ts.isAsExpression(n))) n = n.expression; return n; };
function isValidationCall(n) {
  if (!ts.isCallExpression(n)) return false;
  if (ts.isIdentifier(n.expression) && n.expression.text === 'body') return true;
  return ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'parse';
}
/**
 * True when a c.req.json() result reaches body() or a .parse() call: directly as its argument, or through a
 * `const raw = await c.req.json()` variable that is later passed to one.
 */
function jsonIsValidated(call, root) {
  for (let p = call.parent; p && p !== root.parent; p = p.parent) {
    if (isValidationCall(p) && p.arguments.some((a) => a.pos <= call.pos && call.end <= a.end)) return true;
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && unwrap(p.initializer) === call) {
      const name = p.name.text;
      let used = false;
      const find = (n) => {
        if (isValidationCall(n) && n.arguments.some((a) => ts.isIdentifier(unwrap(a)) && unwrap(a).text === name)) used = true;
        if (!used) ts.forEachChild(n, find);
      };
      find(root);
      return used;
    }
    if (ts.isBlock(p) || ts.isVariableStatement(p)) break;
  }
  return false;
}
/** `ctx.config.devMode` used to decide something (if / ternary / && / ||), not merely reported in a response. */
function drivesControlFlow(n) {
  let child = n;
  for (let p = n.parent; p; child = p, p = p.parent) {
    if (ts.isPrefixUnaryExpression(p) || ts.isParenthesizedExpression(p)) continue;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(p.operatorToken.kind)) continue;
    return (ts.isIfStatement(p) && p.expression === child) || (ts.isConditionalExpression(p) && p.condition === child);
  }
  return false;
}

/**
 * Walks `node` (and, through `seen`, every function it calls that lives in the demo API sources) and records
 * the facts. `depth` is 0 for the route's own handler.
 */
function collect(node, abs, facts, seen, depth) {
  const sf = load(abs).sf;
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      if (ts.isIdentifier(callee)) {
        const name = callee.text;
        if (name === 'userOf') facts.roles.add(str(n.arguments[1]) ?? 'user');
        else if (name === 'adminOf') facts.roles.add('admin');
        else if (name === 'requirePermission') { const p = str(n.arguments[1]); if (p) facts.perms.add(p); }
        else if (name === 'idempotent') facts.idem.add(n.arguments[5]?.kind === ts.SyntaxKind.FalseKeyword ? 'optional' : 'required');
        else if (name === 'body') { const s = n.arguments[1]; if (s) facts.schemas.add(s.getText(sf)); }
        else if (name === 'verifySignature') facts.signature = true;
        if (HELPERS.has(name)) facts.anyOf.set(name, HELPERS.get(name));
        if (!INTRINSICS.has(name)) {
          const def = resolveDef(abs, name);
          if (def && def.abs.startsWith(SRC) && !seen.has(def.node)) {
            seen.add(def.node);
            collect(def.node, def.abs, facts, seen, depth + 1);
          }
        }
      } else if (ts.isPropertyAccessExpression(callee)) {
        const prop = callee.name.text;
        const target = callee.expression;
        if (prop === 'parse') {
          const arg = n.arguments[0];
          const fromParams = arg && (reqCall(unwrap(arg), 'param') || reqCall(unwrap(arg), 'query'));
          if (!fromParams && arg) {
            if (ts.isIdentifier(target) && /Schema$/.test(target.text)) facts.schemas.add(target.text);
            else if (target.getText(sf).replace(/\s+/g, '').startsWith('z.')) facts.schemas.add('inline zod');
            else if (ts.isElementAccessExpression(target)) facts.schemas.add('schema picked at runtime');
          }
        }
        if (prop === 'includes' && /permissions$/.test(target.getText(sf))) { const p = str(n.arguments[0]); if (p && PERMISSIONS.includes(p)) facts.inline.add(p); }
        if (reqCall(n, 'query')) { const q = str(n.arguments[0]); if (q) facts.query.add(q); }
        if (reqCall(n, 'json') && !jsonIsValidated(n, node)) facts.rawJson = true;
        if (prop === 'get' && str(n.arguments[0]) === 'principal') facts.principal = true;
      }
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken && /\.kind$/.test(n.left.getText(sf)) && str(n.right) === 'user') facts.userOnly = true;
    if (ts.isPropertyAccessExpression(n) && n.getText(sf) === 'ctx.config.devMode' && depth === 0 && drivesControlFlow(n)) {
      facts.devRefs = true;
      const neg = n.parent;
      const cond = neg && ts.isPrefixUnaryExpression(neg) && neg.operator === ts.SyntaxKind.ExclamationToken ? neg.parent : null;
      if (cond && ts.isIfStatement(cond) && cond.expression === neg && ts.isThrowStatement(cond.thenStatement) && /FORBIDDEN/.test(cond.thenStatement.getText(sf))) facts.dev403 = true;
    }
    // const key = c.req.header('Idempotency-Key'); if (!key) throw …  → required, checked by hand.
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && reqCall(n.initializer, 'header') && str(n.initializer.arguments[0]) === 'Idempotency-Key') {
      const key = n.name.text;
      const scope = n.parent?.parent?.parent;
      const check = (m) => {
        if (ts.isIfStatement(m) && ts.isPrefixUnaryExpression(m.expression) && m.expression.operand.getText(sf) === key && /throw\b/.test(m.thenStatement.getText(sf))) facts.idem.add('required');
        ts.forEachChild(m, check);
      };
      if (scope) check(scope);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
}

/* ───────── Route discovery ───────── */

function insideDevModeBlock(node, sf) {
  for (let p = node; p?.parent; p = p.parent) {
    const parent = p.parent;
    if (ts.isIfStatement(parent) && parent.thenStatement === p && /\bdevMode\b/.test(parent.expression.getText(sf)) && !parent.expression.getText(sf).trim().startsWith('!')) return true;
  }
  return false;
}

function findRoutes() {
  const routes = [];
  const middleware = [];
  for (const abs of tsFiles(SRC)) {
    const { sf } = load(abs);
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'app') {
        const method = n.expression.name.text;
        const pathArg = n.arguments[0];
        if (method === 'use') middleware.push({ abs, line: line(sf, n), path: str(pathArg) ?? pathArg?.getText(sf) ?? '*', conditional: ts.isIfStatement(n.parent?.parent) ? n.parent.parent.expression.getText(sf) : null });
        if (method === 'onError') middleware.push({ abs, line: line(sf, n), path: 'onError', conditional: null });
        if (METHODS.has(method) && pathArg) {
          const literal = str(pathArg);
          if (literal !== null) routes.push({ method, path: literal, abs, line: line(sf, n), nodes: n.arguments.slice(1), dev: insideDevModeBlock(n, sf) });
          else if (ts.isTemplateExpression(pathArg)) routes.push(...expandTemplate(n, pathArg, method, abs, sf));
          else routes.push({ method, path: pathArg.getText(sf), abs, line: line(sf, n), nodes: n.arguments.slice(1), dev: insideDevModeBlock(n, sf), unresolved: true });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return { routes, middleware };
}

/**
 * `const driverAction = (path, fn) => app.post(\`/driver/rides/:id/${path}\`, …)` followed by
 * `driverAction('arrive', …)`: one route per call, with the call's own arguments added to the handler.
 */
function expandTemplate(call, tpl, method, abs, sf) {
  let fn = call.parent;
  while (fn && !ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn) && !ts.isFunctionDeclaration(fn)) fn = fn.parent;
  const holder = fn && (ts.isFunctionDeclaration(fn) ? fn : ts.isVariableDeclaration(fn.parent) ? fn.parent : null);
  const helper = holder?.name && ts.isIdentifier(holder.name) ? holder.name.text : null;
  const params = fn ? fn.parameters.map((p) => p.name.getText(sf)) : [];
  if (!helper) return [{ method, path: tpl.getText(sf), abs, line: line(sf, call), nodes: call.arguments.slice(1), dev: insideDevModeBlock(call, sf), unresolved: true }];
  const out = [];
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === helper) {
      let path = tpl.head.text;
      for (const span of tpl.templateSpans) {
        const idx = params.indexOf(span.expression.getText(sf));
        const value = idx >= 0 ? str(n.arguments[idx]) : null;
        path += (value ?? `{${span.expression.getText(sf)}}`) + span.literal.text;
      }
      out.push({ method, path, abs, line: line(sf, n), nodes: [...call.arguments.slice(1), ...n.arguments], dev: insideDevModeBlock(n, sf) });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/* ───────── Presentation ───────── */

const AREAS = [
  ['Health and sync', (p) => p === '/health' || p === '/sync'],
  ['Mobile sign-in', (p) => p.startsWith('/auth/')],
  ['Profile', (p) => p === '/me' || p.startsWith('/me/')],
  ['Uploads and verification', (p) => p.startsWith('/uploads') || p.startsWith('/verification')],
  ['Cities and places', (p) => p === '/cities' || p.startsWith('/places/')],
  ['Passenger: quotes, payment methods, rides, scheduled rides', (p) => /^\/(quotes|payment-methods|rides|scheduled)(\/|$)/.test(p)],
  ['Driver', (p) => p.startsWith('/driver/') || p === '/payment-providers'],
  ['Payment provider sandbox and callbacks', (p) => p.startsWith('/provider-sandbox/') || p.startsWith('/providers/')],
  ['Support (passenger and driver)', (p) => p.startsWith('/support/')],
  ['Oct 6 features ("prototype"): passenger and driver', (p) => p.startsWith('/prototype/')],
  ['Admin sign-in', (p) => p.startsWith('/admin/auth/') || p === '/admin/me'],
  ['Admin: Oct 6 features ("prototype")', (p) => p.startsWith('/admin/prototype')],
  ['Admin', (p) => p.startsWith('/admin/')],
  ['Development tools', (p) => p.startsWith('/dev/')],
  ['Other', () => true],
];

const code = (s) => `\`${s}\``;
const link = (abs, ln) => `[${posix(relative(SRC, abs))}:${ln}](${posix(relative(dirname(OUT), abs))}#L${ln})`;

function callerOf(f) {
  if (f.signature) return 'provider (HMAC)';
  const roles = [...f.roles];
  if (roles.includes('admin')) return roles.length > 1 ? `admin or ${roles.filter((r) => r !== 'admin').join(' / ')}` : 'admin';
  const specific = roles.filter((r) => r !== 'user');
  if (specific.length) return specific.join(' / ');
  if (roles.includes('user')) return 'user (any role)';
  if (f.principal) return f.userOnly ? 'user (any role)' : 'signed in (user or admin)';
  return 'public';
}

function permissionOf(f) {
  const parts = [...f.perms].sort().map((p) => {
    const alt = [...f.anyOf.values()].find((h) => h.perms.includes(p));
    return alt ? `${code(p)} or ${alt.perms.filter((x) => x !== p).map(code).join(' or ')} (${code(alt.name)})` : code(p);
  });
  const inline = [...f.inline].filter((p) => !f.perms.has(p)).sort();
  if (inline.length) parts.push(`inline: ${inline.map(code).join(', ')}`);
  return parts.join('; ') || '—';
}

function inputOf(r, f) {
  const parts = [];
  const schemas = [...f.schemas].sort();
  if (schemas.length) parts.push(schemas.map((s) => (/Schema$/.test(s) ? code(s) : s)).join(', '));
  if (f.rawJson) parts.push('raw JSON (not validated)');
  if (f.signature) parts.push('raw body, signed');
  const q = [...f.query];
  if (q.length) parts.push(`query ${q.map(code).join(', ')}`);
  return parts.join('; ') || '—';
}

function notesOf(r, f) {
  const notes = [];
  if (r.dev) notes.push('dev mode only');
  if (f.dev403) notes.push('403 unless dev mode');
  else if (f.devRefs && !r.dev) notes.push('dev-mode branch');
  if (r.duplicate) notes.push('**duplicate registration**');
  if (r.unresolved) notes.push('path not resolved by the generator');
  return notes.join('; ');
}

function render({ routes, middleware }) {
  const rows = routes.map((r) => {
    const facts = newFacts();
    const seen = new Set();
    for (const n of r.nodes) collect(n, r.abs, facts, seen, 0);
    return { ...r, facts };
  });
  const keyCount = new Map();
  for (const r of rows) keyCount.set(`${r.method} ${r.path}`, (keyCount.get(`${r.method} ${r.path}`) ?? 0) + 1);
  for (const r of rows) r.duplicate = keyCount.get(`${r.method} ${r.path}`) > 1;
  for (const r of rows) r.area = AREAS.findIndex(([, test]) => test(r.path));
  const fileOrder = (abs) => (abs.endsWith(`${sep}app.ts`) ? 0 : 1);
  rows.sort((a, b) => a.area - b.area || fileOrder(a.abs) - fileOrder(b.abs) || a.abs.localeCompare(b.abs) || a.line - b.line);

  const byMethod = {};
  for (const r of rows) byMethod[r.method.toUpperCase()] = (byMethod[r.method.toUpperCase()] ?? 0) + 1;
  const sourceFiles = [...new Set(rows.map((r) => r.abs))].sort((a, b) => fileOrder(a) - fileOrder(b) || a.localeCompare(b));
  const caller = (r) => callerOf(r.facts);
  const count = (pred) => rows.filter(pred).length;

  const out = [];
  out.push('<!-- GENERATED FILE: do not edit by hand. Run `node scripts/docs/gen-api-reference.mjs`. -->');
  out.push('');
  out.push('# Demo API reference');
  out.push('');
  out.push(`Generated — run \`node ${SCRIPT}\` after you add, remove or change a route, and commit the result.`);
  out.push(`\`node ${SCRIPT} --check\` exits 1 when this file no longer matches the code.`);
  out.push('Last verified: whenever the check above passes. Owner: whoever changes a route.');
  out.push('');
  out.push('Every HTTP route of `services/demo-api`, read from its Hono registrations in');
  out.push(sourceFiles.map((a) => `[${posix(relative(SRC, a))}](${posix(relative(dirname(OUT), a))})`).join(' and ') + '.');
  out.push('The same app serves the Node server on :4010, the in-process demo inside native standalone builds and the tests');
  out.push('(see [runtime-modes.md](runtime-modes.md)). Request and response types live in `packages/api/src/client.ts`;');
  out.push('schemas in `packages/domain/src/schemas.ts`, except the Oct 6 feature schemas (`childSchema`, `categorySchema`…),');
  out.push('which are local to `services/prototype.ts`. Who may call what, and why: [permissions.md](permissions.md).');
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push('| | Routes |');
  out.push('|---|---|');
  out.push(`| All | ${rows.length} (${Object.entries(byMethod).map(([m, c]) => `${m} ${c}`).join(', ')}) |`);
  for (const c of ['public', 'user (any role)', 'passenger', 'driver', 'admin', 'signed in (user or admin)', 'provider (HMAC)']) {
    const n = count((r) => caller(r) === c);
    if (n) out.push(`| Caller: ${c} | ${n} |`);
  }
  const mixed = count((r) => !['public', 'user (any role)', 'passenger', 'driver', 'admin', 'signed in (user or admin)', 'provider (HMAC)'].includes(caller(r)));
  if (mixed) out.push(`| Caller: other | ${mixed} |`);
  out.push(`| Admin routes with a permission check | ${count((r) => r.facts.roles.has('admin') && r.facts.perms.size)} of ${count((r) => r.facts.roles.has('admin'))} |`);
  out.push(`| Idempotency-Key required | ${count((r) => r.facts.idem.has('required'))} |`);
  out.push(`| Idempotency-Key optional (honoured when sent) | ${count((r) => r.facts.idem.has('optional') && !r.facts.idem.has('required'))} |`);
  out.push(`| Registered only in dev mode | ${count((r) => r.dev)} |`);
  out.push(`| Body read without validation | ${count((r) => r.facts.rawJson)} |`);
  out.push('');
  out.push('## Global behaviour');
  out.push('');
  for (const m of middleware.sort((a, b) => a.abs.localeCompare(b.abs) || a.line - b.line)) {
    const what = m.path === 'onError' ? '`app.onError`' : `\`app.use('${m.path}')\``;
    out.push(`- ${what} at ${link(m.abs, m.line)}${m.conditional ? ` — only when \`${m.conditional}\`` : ''}.`);
  }
  out.push('- Every response carries `X-Server-Time` and, unless the handler sets its own (`GET /uploads/:id`),');
  out.push('  `Cache-Control: no-store`. Errors are');
  out.push('  `{ error: { code, message, details } }`; the HTTP status comes from `httpStatusFor(code)` in `packages/domain`;');
  out.push('  zod failures return 422 with `details.fields`.');
  out.push('- Authentication is a bearer token (`Authorization: Bearer …`) from `POST /auth/otp/verify` (mobile) or');
  out.push('  `POST /admin/auth/login` (admin). The middleware resolves it to a principal on every request.');
  out.push('');
  out.push('## How the columns are derived');
  out.push('');
  out.push('The generator follows each handler into every function it calls inside `services/demo-api/src`.');
  out.push('');
  out.push('| Column | Source in code |');
  out.push('|---|---|');
  out.push('| Caller | `userOf(c, role)` → that role; `userOf(c)` → any user role; `adminOf(c)` → admin; `c.get(\'principal\')` → any signed-in principal; `verifySignature` → provider callback; none → public. |');
  out.push('| Permission | `requirePermission(admin, p)` → required. "or … (helper)": a `@naya/domain` helper that also accepts another permission. "inline": the code reads `admin.permissions.includes(p)` to filter fields or grant access; read the source. |');
  out.push('| Idempotency-Key | `idempotent(…)` → required, or optional when its last argument is `false`; a handler that reads the header and throws without it → required. |');
  out.push('| Input | `body(c, schema)` or `<name>Schema.parse(…)` → validated; `z.object(…).parse(…)` → inline zod; `c.req.json()` not passed to a parser → raw JSON; `c.req.query(name)` → query parameters. |');
  out.push('| Notes | "dev mode only": registered inside `if (ctx.config.devMode)`. "403 unless dev mode": the handler refuses when dev mode is off. "dev-mode branch": the handler behaves differently in dev mode. |');
  out.push('');

  let area = -1;
  for (const r of rows) {
    if (r.area !== area) {
      area = r.area;
      out.push(`## ${AREAS[area][0]}`);
      out.push('');
      out.push('| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |');
      out.push('|---|---|---|---|---|---|---|---|');
    }
    const f = r.facts;
    const idem = f.idem.has('required') ? 'required' : f.idem.has('optional') ? 'optional' : '—';
    out.push(`| ${r.method.toUpperCase()} | ${code(r.path)} | ${caller(r)} | ${permissionOf(f)} | ${idem} | ${inputOf(r, f)} | ${notesOf(r, f)} | ${link(r.abs, r.line)} |`);
    const next = rows[rows.indexOf(r) + 1];
    if (!next || next.area !== area) out.push('');
  }

  out.push('## By admin permission');
  out.push('');
  out.push(`Permissions are the \`AdminPermission\` union in [packages/domain/src/entities.ts](${posix(relative(dirname(OUT), join(DOMAIN_SRC, 'entities.ts')))}).`);
  out.push('"Required" means the route refuses without it (403). "Read inline" means the code checks it to filter fields or grant access.');
  out.push('');
  out.push('| Permission | Required by | Read inline by |');
  out.push('|---|---|---|');
  const ep = (r) => `${r.method.toUpperCase()} ${code(r.path)}`;
  /** The route accepts `p` when it requires it, or when a helper it calls lets `p` stand in for a required one. */
  const accepts = (r, p) => {
    if (r.facts.perms.has(p)) {
      const alt = [...r.facts.anyOf.values()].find((h) => h.perms.includes(p));
      return alt ? `${ep(r)} (or ${alt.perms.filter((x) => x !== p).map(code).join(', ')})` : ep(r);
    }
    for (const h of r.facts.anyOf.values()) {
      const stand = [...r.facts.perms].filter((x) => h.perms.includes(x));
      if (h.perms.includes(p) && stand.length) return `${ep(r)} (instead of ${stand.map(code).join(', ')})`;
    }
    return null;
  };
  for (const p of PERMISSIONS) {
    const req = rows.map((r) => accepts(r, p)).filter(Boolean);
    const inl = rows.filter((r) => r.facts.inline.has(p) && !r.facts.perms.has(p)).map(ep);
    out.push(`| ${code(p)} | ${req.join('<br>') || '—'} | ${inl.join('<br>') || '—'} |`);
  }
  const unchecked = rows.filter((r) => r.facts.roles.has('admin') && !r.facts.perms.size).map(ep);
  out.push(`| (no permission: any signed-in admin) | ${unchecked.join('<br>') || '—'} | |`);
  out.push('');
  return out.join('\n');
}

/* ───────── Main ───────── */

const found = findRoutes();
const markdown = render(found);
const args = new Set(process.argv.slice(2));
if (args.has('--stdout')) {
  process.stdout.write(markdown);
} else if (args.has('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== markdown) {
    console.error(`${rel(OUT)} is stale. Run: node ${SCRIPT}`);
    process.exit(1);
  }
  console.log(`${rel(OUT)} is up to date (${found.routes.length} routes).`);
} else {
  writeFileSync(OUT, markdown);
  console.log(`Wrote ${rel(OUT)} (${found.routes.length} routes).`);
}
