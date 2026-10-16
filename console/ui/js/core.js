'use strict';
/* Core helpers: DOM builder, API calls, modal, toasts, router, small utilities. */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'for') el.setAttribute('for', v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected' || k === 'readOnly') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
const text = (s) => document.createTextNode(s);
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/* ── icons ── */
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  pen: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5a1 1 0 1 0 0-.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L14 3h-4l-.3 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.2 1.3L10 21h4l.3-2.4a7 7 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z',
  check: 'M4 12l5 5L20 6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  plus: 'M12 5v14M5 12h14',
  up: 'M6 14l6-6 6 6',
  down: 'M6 10l6 6 6-6',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M8 8h11v12H8zM5 16V4h11',
  quote: 'M5 17V11a5 5 0 0 1 5-5M5 17h5v-5H5M14 17v-6a5 5 0 0 1 5-5M14 17h5v-5h-5',
  edit: 'M4 20l4-1 11-11-3-3L5 16z',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5'
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONS[name] || '');
  svg.appendChild(p);
  return svg;
}

/* ── API ── */
async function api(method, path, body, opts = {}) {
  if (window.WEB_API) return window.WEB_API(method, path, body, opts); // the browser version keeps files on GitHub
  const init = { method, headers: { 'X-Console': '1' }, credentials: 'same-origin' };
  if (body !== undefined && !opts.raw) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  if (opts.raw) { init.body = body; init.headers['Content-Type'] = 'application/octet-stream'; }
  let res;
  try { res = await fetch(path, init); }
  catch (e) { throw new Error('Cannot reach the console. Is the terminal window still open?'); }
  let data = {};
  try { data = await res.json(); } catch (e) { /* not JSON */ }
  if (!res.ok) {
    const err = new Error(data.error || ('Something went wrong (' + res.status + ')'));
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}
const GET = (p) => api('GET', p);
const POST = (p, b) => api('POST', p, b === undefined ? {} : b);
const PUT = (p, b) => api('PUT', p, b);
const q = encodeURIComponent;
function mediaUrl(p) { return '/media' + p; } // the browser version replaces this

/* ── toasts, busy buttons, dialogs ── */
function toast(msg, kind = '', ms = 3800) {
  const t = h('div', { class: 'toast ' + kind, role: 'status' }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), ms);
}
function fail(e) { console.error(e); toast(e.message || String(e), 'bad', 7000); }

async function busy(btn, fn, label) {
  const old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; if (label) btn.textContent = label; }
  try { return await fn(); }
  catch (e) { fail(e); }
  finally { if (btn) { btn.disabled = false; if (label) btn.textContent = old; } }
}

function openModal({ title, body, actions = [], wide = false, onClose }) {
  const root = $('#modal-root');
  const prevFocus = document.activeElement;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const foot = h('div', { class: 'modal-foot' }, actions.map((a) => {
    const b = h('button', { type: 'button', class: 'btn ' + (a.kind || ''), onclick: async () => { if (a.onclick) { const r = await a.onclick(b, close); if (r !== false && a.close !== false) close(); } else close(); } }, a.label);
    return b;
  }));
  const modal = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { type: 'button', class: 'btn quiet small', onclick: close, 'aria-label': 'Close' }, 'Close')),
    h('div', { class: 'modal-body' }, body),
    actions.length ? foot : null);
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, modal);
  root.append(overlay);
  document.addEventListener('keydown', onKey);
  const first = $('input, textarea, select, button.btn:not(.quiet)', modal);
  if (first) first.focus();
  return { close, modal };
}

function confirmDialog(title, message, okLabel = 'Yes', danger = false) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title, body: h('p', {}, message),
      actions: [
        { label: 'Cancel', kind: 'secondary', onclick: () => { answered = true; resolve(false); } },
        { label: okLabel, kind: danger ? 'danger solid' : '', onclick: () => { answered = true; resolve(true); } }
      ],
      onClose: () => { if (!answered) resolve(false); }
    });
  });
}

/* ── small utilities ── */
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fmtBytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const wordCount = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); toast('Copied', 'ok', 1500); }
  catch (e) {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }); ta.value = s; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied', 'ok', 1500); } catch (_) { toast('Copy failed. Select the text and copy it by hand.', 'bad'); }
    ta.remove();
  }
}
function siteUrl(path) { return ((S.info && S.info.site.url) || '').replace(/\/$/, '') + (path || '/'); }

/* ── state, dirty guard, router ── */
const S = { info: null, dirty: false, routes: [], current: null, here: '', cleanups: [] };
function onLeave(fn) { S.cleanups.push(fn); }
function setDirty(v) { S.dirty = v; }
window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

function route(pattern, handler, nav) { S.routes.push({ re: new RegExp('^' + pattern + '$'), handler, nav }); }
function go(path) { location.hash = '#' + path; }
function setTitle(title, sub, actions) {
  $('#page-title').textContent = title;
  $('#page-sub').textContent = sub || '';
  document.title = title + ' · Site console';
  const box = clear($('#top-actions'));
  if (actions) append(box, actions);
}
let skipGuard = false;
async function render() {
  const path = (location.hash || '#/').slice(1) || '/';
  for (const r of S.routes) {
    const m = path.match(r.re);
    if (!m) continue;
    S.here = location.hash;
    S.current = r;
    S.cleanups.splice(0).forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    const view = clear($('#view'));
    document.body.classList.remove('menu-open');
    try { await r.handler(view, ...m.slice(1).map(decodeURIComponent)); }
    catch (e) { fail(e); view.append(h('div', { class: 'banner bad' }, e.message)); }
    buildNav();
    window.scrollTo(0, 0);
    return;
  }
  go('/');
}
window.addEventListener('hashchange', () => {
  if (skipGuard) { skipGuard = false; return; }
  if (S.dirty) {
    if (!confirm('You have changes that are not saved. Leave without saving?')) {
      skipGuard = true; location.hash = S.here; return;
    }
    S.dirty = false;
  }
  render();
});

async function refreshInfo() {
  try { S.info = await GET('/api/state'); } catch (e) { /* keep old */ }
  buildNav();
  return S.info;
}
