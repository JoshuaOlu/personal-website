'use strict';
/*
  The browser version of the console.
  It shows the same screens as the one on your computer, but your files live on GitHub.
  Nothing is saved to the site until you press Publish: edits are kept in this browser first
  (so drafts never reach the public repository), then sent as one commit.

  Safety notes:
  - The access token is only ever sent to api.github.com (the page's Content-Security-Policy enforces it).
  - It is kept in this tab only unless you tick "Remember on this device".
*/
window.WEB_MODE = true;

(function () {
  const CFG = window.WEB_CONFIG || { apiBase: 'https://api.github.com' };
  const BLOCKED_DIRS = ['.git', '.github', '_site', 'vendor', 'node_modules', '.console-data', 'console', '.jekyll-cache', '.bundle', 'scripts'];
  const BLOCKED_FILES = ['Gemfile.lock'];
  const TEXT_EXT = ['.md', '.markdown', '.html', '.yml', '.yaml', '.css', '.js', '.json', '.txt', '.xml', '.svg', '.liquid'];
  const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
  const NO_FRONT_EXT = ['.yml', '.yaml', '.json', '.js', '.css', '.svg'];
  const DATA_FILES = { cv: '_data/cv.yml', publications: '_data/publications.yml', social: '_data/social.yml', authors: '_data/authors.yml', identity: '_data/identity.yml', ai_bots: '_data/ai_bots.yml', references: '_data/references.yml', home: '_data/home.yml' };
  const KINDS = { projects: '_projects', writing: '_writing', links: '_links', series: '_series', themes: '_themes' };
  const RESERVED_PATHS = ['assets', 'research', 'writing', 'cv', 'about', 'publications', 'ai-policy', 'feed.xml', 'robots.txt', 'llms.txt', 'sitemap.xml', '404.html', 'siwes', 'console', 'admin', 'manage', 'podcast'];

  class UserError extends Error {
    constructor(msg, status = 422) { super(msg); this.status = status; this.data = { error: msg }; }
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');
  const EDIT_BRANCH = 'web-edits';
  const W = { token: null, repo: null, branch: null, workRef: null, pr: null, protectedMain: null, head: null, treeSha: null, tree: new Map(), overlay: new Map(), base: new Map(), blobs: new Map(), ver: 1, headCommitLog: null };

  /* ── storage (token and unsent edits) ── */
  const store = {
    get(k) { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; } },
    setSession(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    setLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  let idb = null;
  function openDb() {
    return new Promise((resolve) => {
      try {
        const r = indexedDB.open('site-console-web', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  function idbGet(key) { return new Promise((res) => { if (!idb) return res(null); try { const t = idb.transaction('kv').objectStore('kv').get(key); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); } catch (e) { res(null); } }); }
  function idbSet(key, val) { return new Promise((res) => { if (!idb) return res(false); try { const t = idb.transaction('kv', 'readwrite'); t.objectStore('kv').put(val, key); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); }
  function idbDel(key) { return new Promise((res) => { if (!idb) return res(false); try { const t = idb.transaction('kv', 'readwrite'); t.objectStore('kv').delete(key); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); }
  const okey = () => 'overlay:' + W.repo;
  let persistTimer = null;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => { idbSet(okey(), { entries: Array.from(W.overlay.entries()), base: Array.from(W.base.entries()) }); }, 150);
  }
  async function restoreOverlay() {
    const saved = await idbGet(okey());
    if (saved && Array.isArray(saved.entries)) {
      W.overlay = new Map(saved.entries); W.base = new Map(saved.base || []);
      W.overlay.forEach((e) => { if (e.v && e.v >= W.ver) W.ver = e.v + 1; });
    }
  }

  /* ── GitHub ── */
  function b64ToBytes(b64) { const bin = atob(b64.replace(/\n/g, '')); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function bytesToB64(bytes) { let s = ''; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)); return btoa(s); }
  async function gh(method, path, body) {
    let res;
    try {
      res = await fetch(CFG.apiBase + path, {
        method, cache: 'no-store',
        headers: Object.assign({ Authorization: 'Bearer ' + W.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { throw new UserError('Cannot reach GitHub. Check your internet connection and try again.', 502); }
    if (res.ok) return res.status === 204 ? {} : res.json();
    let detail = ''; try { detail = (await res.json()).message || ''; } catch (e) { /* no body */ }
    if (res.status === 401) throw new UserError('GitHub did not accept the token. It may have expired or been revoked. Sign out and enter a new one.', 401);
    if (res.status === 403 && /rate limit/i.test(detail)) throw new UserError('GitHub says too many requests were made. Wait a few minutes and try again.', 429);
    if (res.status === 403 || (res.status === 404 && method !== 'GET')) throw new UserError('This token is not allowed to do that. Make a new token for this repository with "Contents: Read and write" permission. (' + detail + ')', 403);
    if (res.status === 404) throw new UserError('GitHub cannot find that. Check the repository name, and that the token was made for this repository.', 404);
    if (res.status === 409 || res.status === 422) throw new UserError('GitHub refused the change: ' + detail, 409);
    throw new UserError('GitHub returned an error (' + res.status + '). ' + detail, res.status);
  }
  const R = () => '/repos/' + W.repo;

  async function refreshTree() {
    const ref = await gh('GET', R() + '/git/ref/heads/' + encodeURIComponent(W.workRef));
    W.head = ref.object.sha;
    const commit = await gh('GET', R() + '/git/commits/' + W.head);
    W.treeSha = commit.tree.sha;
    const t = await gh('GET', R() + '/git/trees/' + W.treeSha + '?recursive=1');
    if (t.truncated) throw new UserError('The repository is too large for the browser version. Use the console on your computer.', 413);
    W.tree = new Map(t.tree.filter((e) => e.type === 'blob').map((e) => [e.path, { sha: e.sha, size: e.size }]));
  }
  // Is there a pull request from the waiting branch that has not been merged or closed yet?
  async function findOpenPr() {
    const owner = W.repo.split('/')[0];
    try {
      const prs = await gh('GET', R() + '/pulls?state=open&head=' + encodeURIComponent(owner + ':' + EDIT_BRANCH) + '&base=' + encodeURIComponent(W.branch));
      return prs.length ? { number: prs[0].number, url: prs[0].html_url, title: prs[0].title } : null;
    } catch (e) {
      if (e.status === 403 || e.status === 404) throw new UserError('This token cannot read pull requests. Make a new one and set "Pull requests" to "Read and write" as well as "Contents".', 403);
      throw e;
    }
  }
  // Work on the live site, plus your waiting edits if a pull request is open.
  async function detectWork() {
    W.pr = await findOpenPr();
    W.workRef = W.pr ? EDIT_BRANCH : W.branch;
  }
  async function checkProtection() {
    W.protectedMain = null;
    try {
      const rules = await gh('GET', R() + '/rules/branches/' + encodeURIComponent(W.branch));
      if (Array.isArray(rules) && rules.some((r) => r.type === 'pull_request')) { W.protectedMain = true; return; }
    } catch (e) { /* older repos: fall through */ }
    try { const b = await gh('GET', R() + '/branches/' + encodeURIComponent(W.branch)); W.protectedMain = !!b.protected; } catch (e) { W.protectedMain = null; }
  }
  async function connect() {
    const r = await gh('GET', R());
    W.branch = r.default_branch;
    await detectWork();
    await refreshTree();
    await checkProtection();
    idb = await openDb();
    await restoreOverlay();
  }
  async function blob(sha) {
    if (W.blobs.has(sha)) return W.blobs.get(sha);
    const j = await gh('GET', R() + '/git/blobs/' + sha);
    const bytes = j.encoding === 'base64' ? b64ToBytes(j.content) : enc.encode(j.content);
    W.blobs.set(sha, bytes);
    return bytes;
  }

  /* ── files (remote + unsent edits) ── */
  function resolve(rel, mustExist) {
    rel = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rel) throw new UserError('No file name was given.', 400);
    if (rel.includes('\0')) throw new UserError('That path is not allowed.', 403);
    const parts = rel.split('/');
    if (parts.some((p) => p === '..' || p === '.' || p === '')) throw new UserError('That path is not allowed.', 403);
    if (BLOCKED_DIRS.includes(parts[0]) || parts.includes('.git')) throw new UserError('That folder is off limits.', 403);
    if (BLOCKED_FILES.includes(parts[parts.length - 1])) throw new UserError('That file is off limits.', 403);
    if (mustExist && !exists(rel)) throw new UserError('That file does not exist.', 404);
    return rel;
  }
  function exists(p) { const o = W.overlay.get(p); return o ? o.kind !== 'del' : W.tree.has(p); }
  async function readBytes(p) {
    const o = W.overlay.get(p);
    if (o) { if (o.kind === 'del') throw new UserError('That file does not exist.', 404); return o.kind === 'text' ? enc.encode(o.text) : o.bytes; }
    const e = W.tree.get(p);
    if (!e) throw new UserError('That file does not exist.', 404);
    if (!W.base.has(p)) W.base.set(p, e.sha);
    return blob(e.sha);
  }
  async function readText(p) { return dec.decode(await readBytes(p)).replace(/^﻿/, ''); }
  function sameAsRemote(p, bytesOrText) {
    const e = W.tree.get(p);
    if (!e || !W.blobs.has(e.sha)) return false;
    const remote = W.blobs.get(e.sha);
    const mine = typeof bytesOrText === 'string' ? enc.encode(bytesOrText) : bytesOrText;
    if (remote.length !== mine.length) return false;
    for (let i = 0; i < mine.length; i++) if (remote[i] !== mine[i]) return false;
    return true;
  }
  function writeText(p, text) {
    p = resolve(p);
    if (sameAsRemote(p, text)) W.overlay.delete(p); else W.overlay.set(p, { kind: 'text', text, v: W.ver++ });
    persist();
  }
  function writeBytes(p, bytes) { p = resolve(p); W.overlay.set(p, { kind: 'bin', bytes, v: W.ver++ }); persist(); }
  function removeFile(p) {
    p = resolve(p, true);
    if (W.tree.has(p)) W.overlay.set(p, { kind: 'del', v: W.ver++ }); else W.overlay.delete(p);
    persist();
  }
  function allPaths() {
    const set = new Set(W.tree.keys());
    W.overlay.forEach((o, p) => { if (o.kind === 'del') set.delete(p); else set.add(p); });
    return Array.from(set).sort();
  }
  const ext = (p) => { const m = /\.[^./]+$/.exec(p); return m ? m[0].toLowerCase() : ''; };
  const base = (p) => p.split('/').pop();
  const stem = (p) => base(p).replace(/\.[^.]+$/, '');
  async function pool(items, n, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
    }));
    return out;
  }

  /* ── YAML ── */
  function jsonable(o) {
    if (o instanceof Date) return o.toISOString().slice(0, 10);
    if (Array.isArray(o)) return o.map(jsonable);
    if (o && typeof o === 'object') { const r = {}; Object.keys(o).forEach((k) => { r[String(k)] = jsonable(o[k]); }); return r; }
    return o;
  }
  function loadYaml(text, label) {
    try { const d = window.jsyaml.load(text); return jsonable(d === undefined ? null : d); }
    catch (e) {
      const line = e.mark && typeof e.mark.line === 'number' ? e.mark.line + 1 : null;
      throw new UserError('The YAML in ' + label + ' has a mistake' + (line ? ' near line ' + line : '') + ': ' + (e.reason || e.message), 422);
    }
  }
  function headerComment(text) {
    const lines = [];
    for (const l of text.split(/(?<=\n)/)) {
      if (l.startsWith('#') || (l.trim() === '' && lines.length)) lines.push(l); else break;
    }
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    return lines.join('');
  }
  function dumpYaml(obj, name) {
    const out = window.jsyaml.dump(obj, { lineWidth: -1, noRefs: true, skipInvalid: true });
    const res = [];
    out.split(/(?<=\n)/).forEach((l, i) => {
      const gap = (Array.isArray(obj) && l.startsWith('- ')) || (!Array.isArray(obj) && typeof obj === 'object' && /^[A-Za-z_][\w-]*:/.test(l)) ||
        (name === 'cv' && (l.startsWith('- title:') || l.startsWith('  - title:')));
      if (i > 0 && gap && res.length && res[res.length - 1].trim() !== '') res.push('\n');
      res.push(l);
    });
    return res.join('');
  }
  async function readData(name) {
    const path = DATA_FILES[name]; if (!path) throw new UserError('Unknown data file.', 404);
    if (!exists(path)) return { data: null, header: '', exists: false };
    const text = await readText(path);
    return { data: loadYaml(text, path), header: headerComment(text), exists: true };
  }
  async function writeData(name, data) {
    const path = DATA_FILES[name]; if (!path) throw new UserError('Unknown data file.', 404);
    const header = exists(path) ? headerComment(await readText(path)) : '';
    if (name === 'cv' && data && typeof data === 'object' && !Array.isArray(data)) data = Object.assign({}, data, { updated: todayStr() });
    const text = (header ? header.replace(/\n+$/, '') + '\n\n' : '') + dumpYaml(data, name);
    loadYaml(text, path);
    writeText(path, text);
  }

  /* ── front matter ── */
  function splitFront(text) {
    const lines = text.split('\n');
    if (!/^---[ \t]*\r?$/.test(lines[0] || '')) return ['', text, false];
    for (let i = 1; i < lines.length; i++) {
      if (/^---[ \t]*\r?$/.test(lines[i])) return [lines.slice(1, i).join('\n'), lines.slice(i + 1).join('\n'), true];
    }
    return ['', text, false];
  }
  async function readDoc(path) {
    path = resolve(path, true);
    let text = await readText(path);
    const crlf = text.includes('\r\n');
    text = text.replace(/\r\n/g, '\n');
    const o = W.overlay.get(path);
    const mtime = o ? o.v : 0;
    const e = ext(path);
    if (NO_FRONT_EXT.includes(e) || !text.startsWith('---')) return { path, front_raw: '', body: text, front: {}, has_front: false, crlf, mtime, ext: e };
    const [front, body, found] = splitFront(text);
    if (!found) return { path, front_raw: '', body: text, front: {}, has_front: false, crlf, mtime, ext: e };
    let parsed = front.trim() ? loadYaml(front, path) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
    return { path, front_raw: front, body, front: parsed, has_front: true, crlf, mtime, ext: e };
  }
  async function writeDoc(path, frontRaw, body, expectedMtime, hasFront = true) {
    path = resolve(path);
    const o = W.overlay.get(path);
    if (expectedMtime && o && o.v !== expectedMtime && exists(path)) throw new UserError('This file was changed somewhere else since you opened it. Reload it before saving so nothing is lost.', 409);
    if (hasFront && String(frontRaw || '').trim()) loadYaml(String(frontRaw), 'the front matter');
    if (!hasFront && ['.yml', '.yaml'].includes(ext(path))) loadYaml(String(body || ''), path);
    if (!hasFront && ext(path) === '.json') { try { JSON.parse(String(body || '')); } catch (e) { throw new UserError('That is not valid JSON: ' + e.message, 422); } }
    let crlf = false;
    if (exists(path)) { try { crlf = (await readText(path)).includes('\r\n'); } catch (e) { /* new file */ } }
    const front = String(frontRaw || '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
    let text = hasFront ? '---\n' + front + '\n---\n' + String(body || '').replace(/\r\n/g, '\n') : String(body || '').replace(/\r\n/g, '\n');
    if (crlf) text = text.replace(/\n/g, '\r\n');
    writeText(path, text);
    const now = W.overlay.get(path);
    return now ? now.v : 0;
  }
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function patchScalar(front, key, value) {
    const lines = front.split('\n');
    const re = new RegExp('^' + escRe(key) + ':(\\s|$)');
    const idx = lines.findIndex((l) => re.test(l));
    const newLine = key + ': ' + value;
    if (idx >= 0) {
      let j = idx + 1;
      const nextIndented = (from) => { for (let k = from; k < lines.length; k++) if (lines[k].trim() !== '') return /^[ \t]+\S/.test(lines[k]); return false; };
      while (j < lines.length && (/^[ \t]+\S/.test(lines[j]) || (lines[j].trim() === '' && nextIndented(j + 1)))) j++;
      lines.splice(idx, j - idx, newLine);
    } else lines.push(newLine);
    return lines.join('\n');
  }
  function replaceBlock(text, key, block) {
    const lines = text.split('\n');
    const re = new RegExp('^' + escRe(key) + ':(\\s|$)');
    const i = lines.findIndex((l) => re.test(l));
    if (i >= 0) {
      let j = i + 1;
      while (j < lines.length && /^[ \t]/.test(lines[j])) j++;
      lines.splice(i, j - i, ...block.replace(/\n$/, '').split('\n'));
      return lines.join('\n');
    }
    return text.replace(/\s+$/, '') + '\n\n' + block;
  }
  function wrapFolded(str, width = 78) {
    const words = str.split(' '); const lines = []; let cur = '';
    words.forEach((w) => {
      if (!cur) cur = w; else if (cur.length + 1 + w.length <= width) cur += ' ' + w; else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines.map((l) => '  ' + l).join('\n');
  }
  const slugifyW = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const Q = (s) => JSON.stringify(String(s == null ? '' : s));

  /* ── documents ── */
  function urlFor(kind, slug, fm) {
    if (fm && String(fm.permalink || '').startsWith('/')) return fm.permalink;
    if (kind === 'projects') return '/research/' + slug + '/';
    if (kind === 'writing') return '/writing/' + slug + '/';
    if (kind === 'series') return '/writing/series/' + slug + '/';
    if (kind === 'themes') return '/writing/themes/' + slug + '/';
    return '/' + slug + '/';
  }
  async function listKind(kind) {
    const dir = KINDS[kind]; if (!dir) throw new UserError('Unknown kind.', 404);
    const files = allPaths().filter((p) => p.startsWith(dir + '/') && p.split('/').length === 2 && /\.(md|markdown|html)$/.test(p));
    return pool(files, 6, async (p) => {
      const slug = stem(p);
      try {
        const d = await readDoc(p);
        return { path: p, slug, title: d.front.title || slug, front: d.front, url: urlFor(kind, slug, d.front), mtime: d.mtime, error: null };
      } catch (e) { return { path: p, slug, title: base(p), front: {}, url: null, mtime: 0, error: e.message }; }
    });
  }
  async function takenUrls(exceptPath) {
    const urls = RESERVED_PATHS.map((r) => '/' + r + '/');
    for (const kind of Object.keys(KINDS)) {
      (await listKind(kind)).forEach((d) => { if (d.path !== exceptPath && d.url) urls.push(d.url); });
    }
    const tops = new Set();
    allPaths().forEach((p) => { const parts = p.split('/'); if (parts.length === 2 && /^index\./.test(parts[1]) && !parts[0].startsWith('_') && !parts[0].startsWith('.')) tops.add(parts[0]); });
    tops.forEach((t) => urls.push('/' + t + '/'));
    return urls;
  }
  async function newDoc(kind, slug, title, extra) {
    extra = extra || {};
    const dir = KINDS[kind]; if (!dir) throw new UserError('Unknown kind.', 404);
    slug = slugifyW(slug);
    if (!slug) throw new UserError('Please give it a short name made of letters, numbers and dashes.', 422);
    const rel = dir + '/' + slug + '.md';
    if (exists(rel)) throw new UserError('Something with that name already exists.', 409);
    title = String(title || '').trim() || (slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()));
    const today = todayStr();
    let front; let body;
    if (kind === 'projects') {
      front = ['title: ' + Q(title), 'tagline: One line that says what it is', 'summary: >-', '  Two sentences for the cards on the home and Research pages.', 'description: >-', '  One or two sentences for Google and link previews (about 150 characters).', 'status: In progress', 'period: ' + new Date().getFullYear(), 'order: 50', 'updated: ' + today].join('\n');
      body = 'Write the page here. Use the headings you want, for example **What is this?** and **Why it matters**.\n';
    } else if (kind === 'writing') {
      front = ['title: ' + Q(title), 'date: ' + today, 'summary: >-', '  One or two sentences that say what this piece argues. Shown in the list and on search results.', 'description: >-', '  About 150 characters for Google and link previews.', 'tags: []', 'published: false'].join('\n');
      const sl = String(extra.series || '').replace(/[^a-z0-9-]/g, '');
      if (sl) { front += '\nseries: ' + sl; if (parseInt(extra.series_part, 10) > 0) front += '\nseries_part: ' + parseInt(extra.series_part, 10); }
      const th = (Array.isArray(extra.themes) ? extra.themes : []).map((t) => String(t).replace(/[^a-z0-9-]/g, '')).filter(Boolean);
      if (th.length) front += '\nthemes: [' + th.join(', ') + ']';
      body = 'Write your piece here.\n';
    } else if (kind === 'series') {
      front = ['title: ' + Q(title), 'short_title: ' + Q(title), 'summary: >-', '  One or two sentences about what the series argues.', 'status: ongoing', 'total_parts: 3', 'planned: []'].join('\n');
      body = 'Say, in a few lines, what this series argues and why it is worth reading in order. This shows at the top of the series page.\n';
    } else if (kind === 'themes') {
      const orders = (await listKind('themes')).map((t) => parseInt(t.front.order, 10) || 0);
      front = ['title: ' + Q(title), 'summary: >-', '  One sentence that says what this theme is about.', 'order: ' + ((orders.length ? Math.max(...orders) : 0) + 10)].join('\n');
      body = '';
    } else throw new UserError('Use the short links tool to create a short link.', 400);
    writeText(rel, '---\n' + front + '\n---\n' + body);
    return rel;
  }
  async function validateLinkFields(f, existingPath) {
    const path = String(f.path || '').trim().replace(/^\/+|\/+$/g, '');
    const segs = path.split('/').filter(Boolean);
    if (!segs.length) throw new UserError('Please type the address people will use, for example survey or siwes/survey.', 422);
    if (!(segs.length <= 3 && segs.every((s) => /^[a-z0-9][a-z0-9-]*$/.test(s)))) throw new UserError('Use only lowercase letters, numbers and dashes in the address, with / between parts (up to three parts).', 422);
    const url = '/' + path + '/';
    if ((await takenUrls(existingPath)).includes(url) || (RESERVED_PATHS.includes(segs[0]) && segs.length === 1)) throw new UserError('The address ' + url + ' is already used by another page.', 409);
    const dest = String(f.destination || '').trim();
    if (!(dest.startsWith('https://') || /^\/(?!\/)/.test(dest))) throw new UserError('The destination must start with https:// (or / for a page on this site).', 422);
    return [path, url, dest];
  }
  async function createLink(f) {
    const [path, url, dest] = await validateLinkFields(f);
    const slug = path.replace(/\//g, '-');
    const rel = '_links/' + slug + '.md';
    if (exists(rel)) throw new UserError('A short link with that address already exists.', 409);
    const e = (v) => String(v == null ? '' : v).trim();
    const L = [];
    L.push('title: ' + Q(e(f.title) ? f.title : slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())));
    if (e(f.description)) L.push('description: ' + Q(f.description));
    L.push('permalink: ' + url, '', '# Where this link sends people. Must start with https:// (or / for a page on this site).', 'destination: ' + Q(dest),
      '# live = forwards people. paused = shows "not open yet". ended = shows "closed".', 'status: live',
      '# Optional dates (YYYY-MM-DD). The link opens and closes by itself on these days.',
      'opens_on:' + (e(f.opens_on) ? ' ' + e(f.opens_on) : ''), 'ends_on:' + (e(f.ends_on) ? ' ' + e(f.ends_on) : ''),
      '# What the destination is called ("Taking you to ...").', 'label: ' + Q(e(f.label) ? f.label : 'the link'),
      '# Where people can go instead, and what to call that link.', 'fallback_url: ' + (e(f.fallback_url) ? f.fallback_url : '/'), 'fallback_label: ' + Q(e(f.fallback_label) ? f.fallback_label : 'go to the home page'),
      '# When the link has closed: message (show a note) or forward (send them to fallback_url).', 'after_end: ' + (f.after_end === 'forward' ? 'forward' : 'message'),
      'ended_message: ' + Q(e(f.ended_message) ? f.ended_message : 'Thank you for your interest. This link is no longer open.'),
      'paused_message: ' + Q(e(f.paused_message) ? f.paused_message : 'This link is not open yet. Please check back soon.'));
    if (String(f.image_path || '').startsWith('/')) {
      L.push('image:', '  path: ' + f.image_path);
      if (parseInt(f.image_width, 10) > 0) L.push('  width: ' + parseInt(f.image_width, 10));
      if (parseInt(f.image_height, 10) > 0) L.push('  height: ' + parseInt(f.image_height, 10));
      if (e(f.image_alt)) L.push('  alt: ' + Q(f.image_alt));
    }
    const body = e(f.explainer) ? e(f.explainer) + '\n' : '';
    writeText(rel, '---\n' + L.join('\n') + '\n---\n' + body);
    return rel;
  }
  async function linkAction(j) {
    const path = String(j.path || '');
    if (!/^_links\/[\w.-]+\.md$/.test(path)) throw new UserError('That is not a short link file.', 400);
    const doc = await readDoc(path);
    let front = doc.front_raw;
    if (j.action === 'pause') front = patchScalar(front, 'status', 'paused');
    else if (j.action === 'resume') front = patchScalar(front, 'status', 'live');
    else if (j.action === 'end') front = patchScalar(front, 'status', 'ended');
    else if (j.action === 'set') {
      if (!['destination', 'opens_on', 'ends_on', 'after_end', 'fallback_url', 'fallback_label', 'label', 'ended_message', 'paused_message'].includes(j.key)) throw new UserError('Unknown field.', 400);
      const v = String(j.value == null ? '' : j.value);
      front = patchScalar(front, j.key, ['opens_on', 'ends_on'].includes(j.key) ? v : JSON.stringify(v));
    } else throw new UserError('Unknown action.', 400);
    await writeDoc(path, front, doc.body);
    return { ok: true };
  }

  /* ── settings ── */
  async function readConfig() {
    const data = loadYaml(await readText('_config.yml'), '_config.yml') || {};
    const out = {};
    ['title', 'tagline', 'author', 'email', 'url', 'lang'].forEach((k) => { out[k] = data[k] == null ? '' : String(data[k]); });
    out.description = String(data.description || '').trim();
    out.nav = data.nav || []; out.twitter = data.twitter || {};
    return out;
  }
  async function writeConfig(patch) {
    let text = (await readText('_config.yml')).replace(/\r\n/g, '\n');
    for (const k of ['title', 'tagline', 'author', 'email', 'url', 'lang']) {
      if (!(k in patch)) continue;
      const v = String(patch[k] == null ? '' : patch[k]).trim();
      if (k === 'url' && !v.startsWith('https://')) throw new UserError('The web address must start with https://', 422);
      if (k === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw new UserError('That does not look like an email address.', 422);
      text = patchScalar(text, k, Q(v));
    }
    if ('description' in patch) text = patchScalar(text, 'description', '>-\n' + wrapFolded(String(patch.description || '').trim().replace(/\s+/g, ' ')));
    if ('nav' in patch) {
      if (!Array.isArray(patch.nav)) throw new UserError('The menu must be a list.', 422);
      let block = 'nav:\n';
      patch.nav.forEach((it) => {
        const label = String(it.label || '').trim(); const url = String(it.url || '').trim();
        if (!label || !url) return;
        block += '  - label: ' + Q(label) + '\n    url: ' + (url.startsWith('http') || url.startsWith('/') ? url : '/' + url) + '\n';
        if (String(it.collection || '').trim()) block += '    collection: ' + it.collection + '\n';
        if (String(it.data || '').trim()) block += '    data: ' + it.data + '\n';
        if (it.external) block += '    external: true\n';
      });
      text = replaceBlock(text, 'nav', block);
    }
    loadYaml(text, '_config.yml');
    writeText('_config.yml', text);
  }

  /* ── pictures ── */
  function imageSize(bytes, e) {
    try {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (e === '.png') { if (bytes.length > 24 && bytes[1] === 0x50) return [dv.getUint32(16), dv.getUint32(20)]; return null; }
      if (e === '.gif') { if (bytes.length > 10 && bytes[0] === 0x47) return [dv.getUint16(6, true), dv.getUint16(8, true)]; return null; }
      if (e === '.jpg' || e === '.jpeg') {
        let i = 2;
        while (i + 9 < bytes.length) {
          if (bytes[i] !== 0xFF) return null;
          const code = bytes[i + 1]; const len = dv.getUint16(i + 2);
          if (code >= 0xC0 && code <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(code)) return [dv.getUint16(i + 7), dv.getUint16(i + 5)];
          i += 2 + len;
        }
        return null;
      }
      if (e === '.svg') {
        const txt = dec.decode(bytes.subarray(0, 4096));
        let m = txt.match(/viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
        if (m) return [Math.round(parseFloat(m[1])), Math.round(parseFloat(m[2]))];
        const w = txt.match(/\swidth="([\d.]+)/); const h = txt.match(/\sheight="([\d.]+)/);
        if (w && h) return [Math.round(parseFloat(w[1])), Math.round(parseFloat(h[1]))];
      }
    } catch (err) { /* fall through */ }
    return null;
  }
  const blobUrls = new Map();
  function mediaUrlWeb(p) {
    const o = W.overlay.get(String(p).replace(/^\//, ''));
    if (o && o.kind === 'bin') {
      const key = p + ':' + o.v;
      if (!blobUrls.has(key)) {
        const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[ext(p)] || 'application/octet-stream';
        blobUrls.set(key, URL.createObjectURL(new Blob([o.bytes], { type })));
      }
      return blobUrls.get(key);
    }
    return p; // already published pictures are served by the live site, on the same address
  }
  function loadDims(url) {
    return new Promise((resolve) => {
      const img = new Image();
      const t = setTimeout(() => resolve(null), 6000);
      img.onload = () => { clearTimeout(t); resolve(img.naturalWidth ? [img.naturalWidth, img.naturalHeight] : null); };
      img.onerror = () => { clearTimeout(t); resolve(null); };
      img.src = url;
    });
  }
  async function listMedia() {
    const files = allPaths().filter((p) => p.startsWith('assets/images/') && IMAGE_EXT.includes(ext(p)));
    return pool(files, 6, async (p) => {
      const o = W.overlay.get(p); const e = W.tree.get(p);
      let size = null;
      if (o && o.kind === 'bin') size = imageSize(o.bytes, ext(p));
      else if (e) {
        const ck = 'dims:' + e.sha; let cached = null;
        try { cached = JSON.parse(localStorage.getItem(ck) || 'null'); } catch (x) { /* none */ }
        if (cached) size = cached; else { size = await loadDims('/' + p); if (size) { try { localStorage.setItem(ck, JSON.stringify(size)); } catch (x) { /* full */ } } }
      }
      return { path: '/' + p, name: base(p), bytes: o && o.kind === 'bin' ? o.bytes.length : (e ? e.size : 0), width: size && size[0], height: size && size[1], mtime: o ? o.v : 0 };
    });
  }
  async function saveMedia(name, bytes, folder) {
    name = base(String(name || '').replace(/\\/g, '/'));
    const e = ext(name);
    if (!(IMAGE_EXT.includes(e) && e !== '.ico')) throw new UserError('Only picture files can be added here (png, jpg, gif, webp, svg).', 422);
    const st = slugifyW(name.replace(/\.[^.]+$/, ''));
    if (!st) throw new UserError('Please rename the file with letters or numbers in its name.', 422);
    folder = String(folder || 'assets/images').replace(/^\/+/, '');
    if (!(folder === 'assets/images' || folder.startsWith('assets/images/'))) throw new UserError('Pictures go in assets/images.', 422);
    const rel = folder + '/' + st + e;
    resolve(rel);
    if (exists(rel)) throw new UserError('A file called ' + st + e + ' is already there. Rename yours or delete the old one first.', 409);
    if (!bytes || !bytes.length) throw new UserError('That file is empty.', 422);
    if (e === '.svg' && /<script|onload\s*=|javascript:/i.test(dec.decode(bytes))) throw new UserError('That SVG contains scripts, so it was not added.', 422);
    writeBytes(rel, bytes);
    const size = imageSize(bytes, e);
    return { ok: true, path: '/' + rel, width: size && size[0], height: size && size[1] };
  }
  async function references(webPath) {
    const needle = String(webPath);
    const self = needle.replace(/^\//, '');
    const files = allPaths().filter((p) => {
      if (p === self) return false;
      const first = p.split('/')[0];
      return !BLOCKED_DIRS.includes(first) && TEXT_EXT.includes(ext(p));
    });
    const hits = [];
    await pool(files, 8, async (p) => { try { if ((await readText(p)).includes(needle)) hits.push(p); } catch (e) { /* skip */ } });
    return hits.sort();
  }
  function editableFiles() {
    return allPaths().filter((p) => {
      const first = p.split('/')[0];
      return !BLOCKED_DIRS.includes(first) && TEXT_EXT.includes(ext(p)) && !/^assets\/(fonts|files)\//.test(p);
    });
  }

  /* ── IndexNow key file ── */
  function indexnowKey() {
    for (const p of allPaths()) { const m = /^([0-9a-f]{32})\.txt$/.exec(p); if (m) return m[1]; }
    return null;
  }

  /* ── what has changed, and publishing ── */
  async function isPrivateDraft(p) {
    if (!/^_writing\/[^/]+\.(md|markdown|html)$/.test(p) || W.tree.has(p)) return false;
    const o = W.overlay.get(p);
    if (!o || o.kind !== 'text') return false;
    const head = (o.text.match(/^---\s*\n([\s\S]*?)\n---/) || [])[1] || '';
    return /^published:\s*false\s*(#.*)?$/m.test(head);
  }
  async function status() {
    const changes = []; const drafts = [];
    for (const [p, o] of W.overlay.entries()) {
      if (await isPrivateDraft(p)) { drafts.push(p); continue; }
      changes.push({ code: '', path: p, label: o.kind === 'del' ? 'deleted' : (W.tree.has(p) ? 'changed' : 'new') });
    }
    changes.sort((a, b) => a.path.localeCompare(b.path));
    const remote = 'https://github.com/' + W.repo;
    return { repo: true, mode: 'pull_request', branch: W.workRef === W.branch ? W.branch : EDIT_BRANCH + ' (waiting for your approval)', changes, remote, actions_url: remote + '/actions', ahead: null, behind: 0, log: W.headCommitLog || [], private_drafts: drafts, pr: W.pr, main_protected: W.protectedMain };
  }
  const ago = (iso) => {
    const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 3600) return Math.round(s / 60) + ' minutes ago';
    if (s < 86400) return Math.round(s / 3600) + ' hours ago';
    return Math.round(s / 86400) + ' days ago';
  };
  async function statusWithNetwork() {
    const st = await status();
    try {
      const ref = await gh('GET', R() + '/git/ref/heads/' + encodeURIComponent(W.workRef));
      const stillOpen = W.workRef === EDIT_BRANCH ? await findOpenPr() : W.pr;
      st.behind = (ref.object.sha !== W.head || (W.workRef === EDIT_BRANCH && !stillOpen)) ? 1 : 0;
      if (W.workRef === EDIT_BRANCH && !stillOpen) st.pr_finished = true;
      const log = await gh('GET', R() + '/commits?per_page=6&sha=' + encodeURIComponent(W.branch));
      W.headCommitLog = log.map((c) => ({ hash: c.sha.slice(0, 7), author: (c.commit.author || {}).name || '', when: ago(c.commit.author.date), subject: c.commit.message.split('\n')[0] }));
      st.log = W.headCommitLog;
    } catch (e) { /* offline is fine here */ }
    return st;
  }
  async function checkSource(paths) {
    const issues = [];
    for (const p of paths) {
      const o = W.overlay.get(p);
      if (!o || o.kind !== 'text') continue;
      try {
        if (['.yml', '.yaml'].includes(ext(p))) loadYaml(o.text, p);
        else if (/\.(md|markdown|html)$/.test(p) && o.text.startsWith('---')) { const [front] = splitFront(o.text.replace(/\r\n/g, '\n')); if (front.trim()) loadYaml(front, p); }
        else if (ext(p) === '.json') JSON.parse(o.text);
      } catch (e) { issues.push({ level: 'error', page: p, message: e.message, fix: 'Open the file and correct it before publishing.' }); }
    }
    return issues;
  }
  async function publish(message, force) {
    const st = await status();
    if (!st.changes.length) throw new UserError('There is nothing new to publish.', 422);
    const issues = await checkSource(st.changes.map((c) => c.path));
    if (issues.length && !force) return { ok: false, blocked: true, issues };
    message = String(message || '').trim() || 'Update site';
    const steps = [];
    const step = (name, ok, output) => steps.push({ name, ok, output: output || '' });
    let pr = null; let addedToExisting = false;
    try {
      // 1. Is the waiting pull request still open? If it was merged or closed, start again from the live site.
      let oldTree = W.tree;
      if (W.workRef === EDIT_BRANCH) {
        const open = await findOpenPr();
        if (!open) { W.pr = null; W.workRef = W.branch; await refreshTree(); }
      }
      // 2. Has anyone changed the same files on GitHub since this page loaded?
      const ref = await gh('GET', R() + '/git/ref/heads/' + encodeURIComponent(W.workRef));
      let parent = ref.object.sha;
      if (parent !== W.head) await refreshTree();
      {
        const clash = st.changes.filter((c) => {
          const before = oldTree.get(c.path); const now = W.tree.get(c.path);
          return (before ? before.sha : null) !== (now ? now.sha : null);
        });
        if (clash.length) {
          step('Check for newer changes', false, 'These files were changed on GitHub since you opened the console, so nothing was sent:\n' + clash.map((c) => '  ' + c.path).join('\n') + '\nUse "Get the latest from GitHub" and redo those edits.');
          return { ok: false, steps };
        }
        parent = W.head;
      }
      step('Check for newer changes', true, 'Up to date.');
      // 3. Upload each changed file, then build one commit on top.
      const items = [];
      for (const c of st.changes) {
        const o = W.overlay.get(c.path);
        if (o.kind === 'del') { items.push({ path: c.path, mode: '100644', type: 'blob', sha: null }); continue; }
        const bytes = o.kind === 'text' ? enc.encode(o.text) : o.bytes;
        const b = await gh('POST', R() + '/git/blobs', { content: bytesToB64(bytes), encoding: 'base64' });
        items.push({ path: c.path, mode: '100644', type: 'blob', sha: b.sha });
      }
      step('Send ' + items.length + ' file' + (items.length === 1 ? '' : 's'), true, '');
      const tree = await gh('POST', R() + '/git/trees', { base_tree: W.treeSha, tree: items });
      const commit = await gh('POST', R() + '/git/commits', { message, tree: tree.sha, parents: [parent] });
      step('Save a version', true, commit.sha.slice(0, 7));
      // 4. Move the waiting branch. The live branch is never touched.
      if (W.workRef === EDIT_BRANCH) {
        await gh('PATCH', R() + '/git/refs/heads/' + EDIT_BRANCH, { sha: commit.sha, force: false });
        addedToExisting = true; pr = W.pr;
      } else {
        try { await gh('POST', R() + '/git/refs', { ref: 'refs/heads/' + EDIT_BRANCH, sha: commit.sha }); }
        catch (e) { await gh('PATCH', R() + '/git/refs/heads/' + EDIT_BRANCH, { sha: commit.sha, force: true }); }
      }
      step('Send to the waiting branch', true, EDIT_BRANCH);
      // 5. Open the pull request, unless one is already waiting.
      if (!pr) {
        const made = await gh('POST', R() + '/pulls', { title: message, head: EDIT_BRANCH, base: W.branch, body: 'Sent from the browser console. Review the changes, then merge to publish.' });
        pr = { number: made.number, url: made.html_url, title: made.title };
      }
      step(addedToExisting ? 'Added to the waiting pull request' : 'Open a pull request', true, pr.url);
    } catch (e) {
      step('Publish', false, e.message);
      return { ok: false, steps };
    }
    st.changes.forEach((c) => { W.overlay.delete(c.path); W.base.delete(c.path); });
    persist();
    W.headCommitLog = null; W.pr = pr; W.workRef = EDIT_BRANCH;
    try { await refreshTree(); } catch (e) { /* the next load will fix it */ }
    return { ok: true, steps, pr_url: pr.url, pr_number: pr.number, added_to_existing: addedToExisting };
  }

  /* ── the same routes the local console has ── */
  const parseUrl = (p) => { const u = new URL(p, 'http://x'); const q = {}; u.searchParams.forEach((v, k) => { q[k] = v; }); return { path: u.pathname, q }; };
  const NOT_HERE = 'This is only in the console on your computer. The browser version covers writing, projects, links, papers, the CV, pictures and settings.';

  async function route(method, rawPath, body, opts) {
    const { path, q } = parseUrl(rawPath);
    const r = `${method} ${path}`;
    switch (r) {
      case 'GET /api/state': {
        const cfg = await readConfig();
        const counts = {};
        for (const k of Object.keys(KINDS)) counts[k] = allPaths().filter((p) => p.startsWith(KINDS[k] + '/') && /\.(md|markdown|html)$/.test(p) && p.split('/').length === 2).length;
        let pubs = []; try { pubs = (await readData('publications')).data || []; } catch (e) { /* none */ }
        counts.publications = Array.isArray(pubs) ? pubs.length : 0;
        return { site: { title: cfg.title, url: cfg.url, email: cfg.email, root: 'github.com/' + W.repo }, counts, preview: { running: false, supported: false }, git: await status(), port: null, windows: false, last_audit: null, indexnow: indexnowKey(), web: true };
      }
      case 'GET /api/list': return { items: await listKind(q.kind) };
      case 'GET /api/doc': { const d = await readDoc(q.path); const kind = Object.keys(KINDS).find((k) => q.path.startsWith(KINDS[k] + '/')); return Object.assign(d, { url: kind ? urlFor(kind, stem(q.path), d.front) : null }); }
      case 'PUT /api/doc': {
        if (!TEXT_EXT.includes(ext(body.path))) throw new UserError('Only text files can be edited here.', 403);
        const mtime = await writeDoc(body.path, body.front_raw, body.body, body.mtime, body.has_front !== false);
        return { ok: true, mtime };
      }
      case 'POST /api/doc/create': {
        const rel = body.kind === 'links' ? await createLink(body) : await newDoc(body.kind, body.slug || body.title, body.title, body.extra);
        return { ok: true, path: rel };
      }
      case 'POST /api/doc/delete': {
        if (!TEXT_EXT.includes(ext(body.path))) throw new UserError('Only text files can be edited here.', 403);
        removeFile(body.path); return { ok: true };
      }
      case 'POST /api/link/action': return linkAction(body);
      case 'POST /api/link/check': return { status: 0, ok: false, error: 'Link checking only works in the console on your computer.' };
      case 'POST /api/yaml/parse': try { return { ok: true, data: loadYaml(String(body.text || ''), 'the front matter') }; } catch (e) { return { ok: false, error: e.message }; }
      case 'GET /api/data': return readData(q.name);
      case 'PUT /api/data': await writeData(q.name, body.data); return { ok: true };
      case 'GET /api/config': return readConfig();
      case 'PUT /api/config': await writeConfig(body); return { ok: true };
      case 'GET /api/media': return { items: await listMedia() };
      case 'PUT /api/media': {
        const bytes = new Uint8Array(await body.arrayBuffer());
        return saveMedia(q.name, bytes, q.folder);
      }
      case 'POST /api/media/delete': {
        const p = String(body.path || '').replace(/^\//, '');
        if (!p.startsWith('assets/images/')) throw new UserError('Only pictures in assets/images can be deleted here.', 403);
        removeFile(p); return { ok: true };
      }
      case 'GET /api/media/refs': return { refs: await references(q.path) };
      case 'GET /api/files': return { files: editableFiles() };
      case 'GET /api/preview': return { running: false, supported: false };
      case 'POST /api/preview/start': case 'POST /api/preview/stop': case 'POST /api/check': case 'POST /api/audit': throw new UserError(NOT_HERE, 501);
      case 'GET /api/audit/last': return { issues: [], counts: null };
      case 'GET /api/built': return { text: null };
      case 'GET /api/git': return statusWithNetwork();
      case 'POST /api/git/publish': return publish(body.message, body.force);
      case 'POST /api/git/pull': {
        await detectWork(); await refreshTree(); await checkProtection(); W.headCommitLog = null;
        return { ok: true, steps: [{ name: 'Get the latest from GitHub', ok: true, output: 'Your unsent edits were kept.' }] };
      }
      case 'GET /api/indexnow': return { key: indexnowKey() };
      case 'POST /api/indexnow/setup': {
        const a = new Uint8Array(16); crypto.getRandomValues(a);
        const key = Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
        writeText(key + '.txt', key); return { ok: true, key };
      }
      case 'POST /api/indexnow/submit': throw new UserError('Sending addresses to search engines only works in the console on your computer.', 501);
      case 'GET /api/checklist': { try { return JSON.parse(localStorage.getItem('checklist:' + W.repo) || '{}'); } catch (e) { return {}; } }
      case 'PUT /api/checklist': store.setLocal('checklist:' + W.repo, JSON.stringify(body.checklist || {})); return { ok: true };
      case 'POST /api/quit': await signOut(); return { ok: true };
      default: throw new UserError('Not found', 404);
    }
  }
  window.WEB_API = async (method, path, body, opts) => route(method, path, body, opts);
  window.mediaUrl = mediaUrlWeb;
  window.WEB_PENDING = () => W.overlay.size;
  window.WEB_PENDING_PATHS = () => Array.from(W.overlay.keys());

  /* ── signing in and out ── */
  async function signOut() {
    const pending = W.overlay.size;
    if (pending && !window.confirm('You have ' + pending + ' edit' + (pending === 1 ? '' : 's') + ' that were not published. Signing out keeps them in this browser for next time. Continue?')) return;
    store.del('wc:token');
    location.reload();
  }
  window.WEB_SIGNOUT = signOut;

  function gate() {
    return new Promise((resolve) => {
      const savedRepo = store.get('wc:repo') || '';
      const root = document.createElement('div');
      root.className = 'gate';
      root.innerHTML = '';
      const card = document.createElement('div'); card.className = 'card gate-card';
      const h1 = document.createElement('h1'); h1.textContent = 'Sign in to edit your site';
      const intro = document.createElement('p'); intro.className = 'sub';
      intro.textContent = 'This page edits your site through GitHub. Your access token stays in this browser and is only ever sent to GitHub.';
      const steps = document.createElement('ol'); steps.className = 'gate-steps';
      [['Open GitHub\'s token page: ', 'https://github.com/settings/personal-access-tokens/new', 'make a fine-grained token'],
        ['Choose "Only select repositories" and pick this site\'s repository.', null, null],
        ['Under Repository permissions, set Contents and Pull requests to "Read and write". Nothing else.', null, null],
        ['Pick a short expiry (30 days is sensible), create it, and paste it below.', null, null]].forEach(([t, href, label]) => {
        const li = document.createElement('li'); li.append(t);
        if (href) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = label; li.append(a); }
        steps.append(li);
      });
      const mk = (labelText, input) => { const f = document.createElement('div'); f.className = 'field'; const l = document.createElement('div'); l.className = 'lbl'; l.textContent = labelText; f.append(l, input); return f; };
      const repo = document.createElement('input'); repo.type = 'text'; repo.placeholder = 'owner/repository'; repo.value = savedRepo; repo.autocomplete = 'off'; repo.spellcheck = false;
      const tok = document.createElement('input'); tok.type = 'password'; tok.placeholder = 'github_pat_…'; tok.autocomplete = 'off'; tok.spellcheck = false;
      const rem = document.createElement('input'); rem.type = 'checkbox';
      const remLab = document.createElement('label'); remLab.className = 'toggle'; remLab.append(rem, document.createTextNode(' Remember on this device (leave off on a shared computer)'));
      const err = document.createElement('div'); err.className = 'err'; err.setAttribute('role', 'alert');
      const go = document.createElement('button'); go.type = 'button'; go.className = 'btn'; go.textContent = 'Sign in';
      const submit = async () => {
        err.textContent = '';
        const r = repo.value.trim(); const t = tok.value.trim();
        if (!/^[\w.-]+\/[\w.-]+$/.test(r)) { err.textContent = 'Type the repository as owner/repository, for example joshua/personal-website.'; return; }
        if (!t) { err.textContent = 'Paste your token.'; return; }
        go.disabled = true; go.textContent = 'Checking…';
        W.token = t; W.repo = r;
        try {
          await connect();
          store.setLocal('wc:repo', r);
          if (rem.checked) store.setLocal('wc:token', t); else store.setSession('wc:token', t);
          root.remove(); resolve();
        } catch (e) { W.token = null; err.textContent = e.message; go.disabled = false; go.textContent = 'Sign in'; }
      };
      go.addEventListener('click', submit);
      tok.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      const note = document.createElement('p'); note.className = 'small muted';
      note.textContent = 'Your edits go to GitHub as a pull request, so nothing goes live until you approve it there. For that to hold, the main branch must require pull requests (see GUIDE.md). Treat the token like a password; you can cancel it any time on GitHub.';
      card.append(h1, intro, steps, mk('Repository', repo), mk('Access token', tok), remLab, err, go, note);
      root.append(card);
      document.body.append(root);
      (savedRepo ? tok : repo).focus();
    });
  }

  window.WEB_BOOT = async function () {
    const t = store.get('wc:token'); const r = store.get('wc:repo');
    if (t && r) {
      W.token = t; W.repo = r;
      try { await connect(); } catch (e) { store.del('wc:token'); W.token = null; await gate(); }
    } else await gate();
    const small = document.querySelector('.brand small'); if (small) small.textContent = 'editing ' + W.repo + ' on GitHub';
    const quit = document.getElementById('quit');
    if (quit) {
      const fresh = quit.cloneNode(true); fresh.textContent = 'Sign out'; quit.replaceWith(fresh);
      fresh.addEventListener('click', signOut);
    }
    window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  };
})();
