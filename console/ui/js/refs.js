'use strict';
/* References: reading BibTeX, RIS and CSL JSON, and writing APA 7 text.
   The formatting here mirrors console/lib/citations.rb, which builds the real pages.
   If you change one, change the other (the tests compare them). */

const Refs = (() => {
  const KEY = '[A-Za-z0-9][A-Za-z0-9:\\-]*';
  const GROUP = new RegExp('\\[(?:[^\\[\\]\\n]*?)(?<![\\w])[-!]?@' + KEY + '[^\\[\\]\\n]*\\]', 'g');
  const ITEM = new RegExp('^\\s*(?<prefix>[^@]*?)\\s*(?<sup>-)?@(?<key>' + KEY + ')\\s*(?:,\\s*(?<loc>[\\s\\S]*?))?\\s*$');
  const ITALIC_TYPES = ['book', 'report', 'thesis', 'web'];
  const TYPES = [['article', 'Journal article'], ['book', 'Book'], ['chapter', 'Book chapter'], ['conference', 'Conference paper'], ['thesis', 'Thesis or dissertation'], ['report', 'Report'], ['web', 'Web page'], ['other', 'Other']];

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const str = (v) => (v == null ? '' : String(v)).trim();
  const plain = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');

  /* ── names ── */
  const isOrg = (a) => str(a.org) !== '';
  const family = (a) => (isOrg(a) ? str(a.org) : str(a.family));
  function initials(given) {
    return str(given).split(/\s+/).filter(Boolean).map((part) => {
      if (/^(?:\p{L}\.)+$/u.test(part)) return part.match(/\p{L}\./gu).join(' ');
      if (part.includes('-')) return part.split('-').filter(Boolean).map((x) => x[0].toUpperCase() + '.').join('-');
      return part[0].toUpperCase() + '.';
    }).join(' ');
  }
  function nameRef(a) { if (isOrg(a)) return family(a); const i = initials(a.given); return i ? family(a) + ', ' + i : family(a); }
  function nameEdit(a) { if (isOrg(a)) return family(a); const i = initials(a.given); return i ? i + ' ' + family(a) : family(a); }
  function authorList(list) {
    const names = list.map(nameRef);
    if (!names.length) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + ', & ' + names[1];
    if (names.length > 20) return names.slice(0, 19).join(', ') + ', . . . ' + names[names.length - 1];
    return names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1];
  }
  function editorList(list) {
    const names = list.map(nameEdit);
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + ' & ' + names[1];
    return names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1];
  }

  /* ── helpers ── */
  const authors = (r) => (Array.isArray(r.authors) ? r.authors : []).filter((a) => a && typeof a === 'object' && family(a) !== '');
  const editors = (r) => (Array.isArray(r.editors) ? r.editors : []).filter((a) => a && typeof a === 'object' && family(a) !== '');
  const yearOf = (r) => (str(r.year) === '' ? 'n.d.' : str(r.year));
  const dash = (s) => str(s).replace(/\s*[-–—]+\s*/g, '–');
  const endPeriod = (s) => { s = str(s); return s === '' || /[.?!]$/.test(s) ? s : s + '.'; };
  function linkFor(r) {
    const d = str(r.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
    if (d) return 'https://doi.org/' + d;
    const u = str(r.url);
    return u || null;
  }
  const linkHtml = (r) => { const l = linkFor(r); return l ? '<a href="' + esc(l) + '">' + esc(l) + '</a>' : null; };
  const it = (s) => '<i>' + esc(s) + '</i>';

  /* ── in-text label ── */
  function shortTitle(r) {
    const words = str(r.title).split(/\s+/).filter(Boolean);
    let t = words.slice(0, 4).join(' ');
    if (words.length > 4) t += '…';
    return t.replace(/[.,:;]$/, '');
  }
  function label(r, narrative) {
    const a = authors(r); const joiner = narrative ? ' and ' : ' &amp; ';
    if (a.length === 0) return ITALIC_TYPES.includes(str(r.type)) ? it(shortTitle(r)) : '&ldquo;' + esc(shortTitle(r)) + '&rdquo;';
    if (a.length === 1) return esc(family(a[0]));
    if (a.length === 2) return esc(family(a[0])) + joiner + esc(family(a[1]));
    return esc(family(a[0])) + ' et al.';
  }
  const labelKey = (r) => label(r) + '\u0000' + str(r.year);
  const stripArticle = (t) => plain(t).replace(/^(a|an|the)\s+/, '');
  function sortKey(r) {
    const a = authors(r);
    const names = a.length ? a.flatMap((x) => [plain(family(x)), plain(x.given)]) : [stripArticle(r.title)];
    return [names.join(' '), str(r.year).padStart(6, '0'), stripArticle(r.title)];
  }
  const cmpKey = (x, y) => { for (let i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; };
  const sortRefs = (list) => list.slice().sort((x, y) => cmpKey(sortKey(x), sortKey(y)));
  function suffixes(used) {
    const groups = {}; used.forEach((r) => { (groups[labelKey(r)] = groups[labelKey(r)] || []).push(r); });
    const out = {};
    Object.values(groups).forEach((g) => { if (g.length > 1) sortRefs(g).forEach((r, i) => { out[r.id] = String.fromCharCode(97 + i); }); });
    return out;
  }

  /* ── the reference list entry (APA 7) ── */
  function reference(r, suffix) {
    suffix = suffix || '';
    const type = str(r.type); const a = authors(r);
    const date = '(' + yearOf(r) + suffix + ').';
    const title = str(r.title);
    let lead = a.length ? esc(authorList(a)) : null;
    if (lead && !/\.$/.test(lead)) lead += '.';
    const link = linkHtml(r);
    const has = (k) => str(r[k]) !== '';
    let main;
    if (type === 'article') {
      const src = [];
      if (has('container')) src.push(it(r.container));
      if (has('volume')) { let v = '<i>' + esc(str(r.volume)) + '</i>'; if (has('issue')) v += '(' + esc(str(r.issue)) + ')'; src.push(v); }
      if (has('pages')) src.push(esc(dash(r.pages)));
      main = [endPeriod(esc(title)), src.length ? endPeriod(src.join(', ')) : null];
    } else if (type === 'chapter') {
      const eds = editors(r);
      let book = 'In ';
      if (eds.length) book += esc(editorList(eds)) + (eds.length > 1 ? ' (Eds.), ' : ' (Ed.), ');
      book += it(str(r.container));
      const extra = [];
      if (has('edition')) extra.push(esc(r.edition) + ' ed.');
      if (has('pages')) extra.push('pp. ' + esc(dash(r.pages)));
      if (extra.length) book += ' (' + extra.join(', ') + ')';
      main = [endPeriod(esc(title)), endPeriod(book), has('publisher') ? endPeriod(esc(r.publisher)) : null];
    } else if (type === 'thesis') {
      const kind = has('genre') ? str(r.genre) : 'Doctoral dissertation';
      const inst = str(r.publisher);
      main = [it(title) + ' [' + esc(kind) + (inst ? ', ' + esc(inst) : '') + '].'];
    } else if (type === 'book') {
      let t = it(title); if (has('edition')) t += ' (' + esc(r.edition) + ' ed.)';
      main = [endPeriod(t), has('publisher') ? endPeriod(esc(r.publisher)) : null];
    } else if (type === 'report') {
      let t = it(title); if (has('number')) t += ' (' + esc(r.number) + ')';
      main = [endPeriod(t), has('publisher') ? endPeriod(esc(r.publisher)) : null];
    } else if (type === 'web') {
      main = [endPeriod(it(title)), has('container') ? endPeriod(esc(r.container)) : null];
    } else if (type === 'conference') {
      const src = [];
      if (has('container')) src.push('In ' + it(r.container));
      if (src.length && has('pages')) src[0] += ' (pp. ' + esc(dash(r.pages)) + ')';
      main = [endPeriod(esc(title)), src.length ? endPeriod(src.join('')) : null, has('publisher') ? endPeriod(esc(r.publisher)) : null];
    } else {
      main = [endPeriod(esc(title)), has('container') ? endPeriod(it(r.container)) : null, has('publisher') ? endPeriod(esc(r.publisher)) : null];
    }
    main = main.filter((x) => x != null);
    let s;
    if (lead) s = [lead, date].concat(main).join(' ');
    else { const head = main.shift() || ''; s = [head, date].concat(main).join(' '); }
    if (link) s += ' ' + link;
    return s;
  }

  /* ── in-text citations ── */
  const yearText = (r, suf) => esc(yearOf(r)) + (suf[r.id] || '');
  const locText = (l) => str(l).replace(/(\d)\s*[-–—]+\s*(\d)/g, '$1–$2');
  function findGroups(md) {
    const text = stripCode(md); const out = []; let m;
    GROUP.lastIndex = 0;
    while ((m = GROUP.exec(text))) {
      const after = text.charAt(m.index + m[0].length);
      if (after === '(' || after === '[') continue;
      if (!out.includes(m[0])) out.push(m[0]);
    }
    return out;
  }
  function stripCode(md) { return String(md).replace(/^(```|~~~).*?^\1[ \t]*$/gms, '').replace(/`[^`\n]*`/g, ''); }
  function itemsOf(inner) {
    return inner.split(';').map((raw) => { const m = ITEM.exec(raw); return m ? m.groups : null; }).filter(Boolean);
  }
  function formatGroup(inner, byId, suf) {
    let narrative = /^\s*!/.test(inner);
    if (narrative) inner = inner.replace(/^\s*!/, '');
    const unknown = [];
    const items = inner.split(';').map((raw) => {
      const m = ITEM.exec(raw); if (!m) return null;
      const key = m.groups.key; const ref = byId[key];
      if (!ref) { unknown.push(key); return { missing: key }; }
      return { ref, prefix: str(m.groups.prefix), suppress: m.groups.sup != null, loc: str(m.groups.loc) };
    }).filter(Boolean);
    let known = items.filter((i) => i.ref);
    if (!known.length && unknown.length) return ['<span class="cite-missing" title="Not in your references">[?' + esc(unknown.join(', ')) + ']</span>', unknown];
    const miss = unknown.map((k) => '<span class="cite-missing">[?' + esc(k) + ']</span>');
    if (narrative) {
      const parts = known.map((i) => {
        let y = yearText(i.ref, suf); if (i.loc) y += ', ' + esc(locText(i.loc));
        return label(i.ref, true) + ' (<a href="#ref-' + esc(i.ref.id) + '">' + y + '</a>)';
      }).concat(miss);
      return ['<span class="cite">' + parts.join('; ') + '</span>', unknown];
    }
    if (known.length > 1 && known.every((i) => i.prefix === '')) {
      const k = (i) => [plain(label(i.ref).replace(/<[^>]+>/g, '')), str(i.ref.year), suf[i.ref.id] || ''];
      known = known.slice().sort((x, y) => cmpKey(k(x), k(y)));
    }
    const pieces = []; let idx = 0;
    while (idx < known.length) {
      const i = known[idx]; const lbl = label(i.ref); const run = [i];
      while (!i.suppress && idx + run.length < known.length) {
        const n = known[idx + run.length];
        if (!(label(n.ref) === lbl && !n.loc && !i.loc && !n.prefix && !i.prefix && !n.suppress)) break;
        run.push(n);
      }
      const pre = i.prefix ? esc(i.prefix) + ' ' : '';
      if (run.length > 1) {
        const yrs = run.map((x) => '<a href="#ref-' + esc(x.ref.id) + '">' + yearText(x.ref, suf) + '</a>');
        pieces.push(pre + lbl + ', ' + yrs.join(', '));
      } else {
        let text = i.suppress ? yearText(i.ref, suf) : lbl + ', ' + yearText(i.ref, suf);
        if (i.loc) text += ', ' + esc(locText(i.loc));
        pieces.push(pre + '<a href="#ref-' + esc(i.ref.id) + '">' + text + '</a>');
      }
      idx += run.length;
    }
    return ['<span class="cite">(' + pieces.concat(miss).join('; ') + ')</span>', unknown];
  }

  /* Everything a piece needs: the swaps, the reference list and the keys it cites. */
  function buildDoc(refs, md) {
    const byId = {}; refs.forEach((r) => { byId[String(r.id)] = r; });
    const groups = findGroups(md); const usedIds = []; const unknownAll = [];
    groups.forEach((g) => itemsOf(g.slice(1, -1)).forEach((i) => { if (byId[i.key] && !usedIds.includes(i.key)) usedIds.push(i.key); }));
    const used = usedIds.map((k) => byId[k]); const suf = suffixes(used);
    const swaps = groups.map((g) => { const [html, unk] = formatGroup(g.slice(1, -1), byId, suf); unk.forEach((k) => { if (!unknownAll.includes(k)) unknownAll.push(k); }); return { src: g, html }; });
    const list = sortRefs(used).map((r) => ({ id: r.id, html: reference(r, suf[r.id] || '') }));
    return { swaps, list, unknown: unknownAll, used: usedIds };
  }

  /* ── reading other formats ── */
  const blank = () => ({ id: '', type: 'article', authors: [], year: '', title: '', container: '', volume: '', issue: '', pages: '', publisher: '', edition: '', doi: '', url: '' });

  const ACCENTS = { "'": '́', '`': '̀', '^': '̂', '"': '̈', '~': '̃', '=': '̄', '.': '̇', c: '̧', v: '̌', u: '̆', H: '̋' };
  const SPECIAL = { '\\ss': 'ß', '\\o': 'ø', '\\O': 'Ø', '\\ae': 'æ', '\\AE': 'Æ', '\\oe': 'œ', '\\OE': 'Œ', '\\aa': 'å', '\\AA': 'Å', '\\l': 'ł', '\\L': 'Ł', '\\i': 'ı' };
  function clean(v) {
    let s = String(v);
    s = s.replace(/\\([`'^"~=.])\s*\{?\\?([A-Za-z])\}?/g, (m, a, c) => (c + ACCENTS[a]).normalize('NFC'));
    s = s.replace(/\\([cvuH])\s*\{([A-Za-z])\}/g, (m, a, c) => (c + ACCENTS[a]).normalize('NFC'));
    s = s.replace(/\\(ss|oe|OE|ae|AE|aa|AA|o|O|l|L|i)(?![A-Za-z])\s*/g, (m, k) => SPECIAL['\\' + k]);
    s = s.replace(/\\([&%$#_{}])/g, '$1').replace(/\\textendash/g, '–').replace(/\\textemdash/g, '—').replace(/~/g, ' ').replace(/---/g, '—').replace(/--/g, '–');
    s = s.replace(/\\(?:emph|textit|textbf|textsc|mathrm)\s*/g, '').replace(/[{}]/g, '');
    return s.replace(/\s+/g, ' ').trim();
  }
  function splitAnd(s) {
    const out = []; let depth = 0; let cur = '';
    const words = s.split(/(\s+)/);
    for (const w of words) {
      for (const ch of w) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      if (depth === 0 && /^and$/i.test(w)) { out.push(cur.trim()); cur = ''; } else cur += w;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.filter(Boolean);
  }
  const PARTICLES = ['van', 'von', 'de', 'der', 'den', 'da', 'di', 'du', 'del', 'della', 'la', 'le', 'dos', 'das', 'ter', 'ten', 'al', 'el', 'bin', 'ibn'];
  function wholeBraced(s) {
    if (s[0] !== '{' || s[s.length - 1] !== '}') return false;
    let d = 0;
    for (let i = 0; i < s.length; i++) { if (s[i] === '{') d++; else if (s[i] === '}') { d--; if (d === 0 && i < s.length - 1) return false; } }
    return d === 0;
  }
  function parseName(raw) {
    raw = raw.trim();
    if (wholeBraced(raw)) return { org: clean(raw) };
    if (raw.includes(',')) {
      const parts = raw.split(',').map((x) => x.trim());
      return { family: clean(parts[0]), given: clean(parts[parts.length - 1]) };
    }
    const words = clean(raw).split(/\s+/);
    if (words.length === 1) return { family: words[0] };
    let i = words.length - 1;
    while (i > 1 && PARTICLES.includes(words[i - 1].toLowerCase())) i--;
    return { family: words.slice(i).join(' '), given: words.slice(0, i).join(' ') };
  }
  const parseNames = (s) => splitAnd(s).map(parseName).filter((a) => a.family || a.org);

  function parseBibtex(text) {
    const out = []; const src = String(text);
    const re = /@([A-Za-z]+)\s*([{(])/g; let m;
    while ((m = re.exec(src))) {
      const kind = m[1].toLowerCase(); const open = m[2]; const close = open === '{' ? '}' : ')';
      let i = re.lastIndex; let depth = 1;
      while (i < src.length && depth > 0) { const c = src[i]; if (c === open) depth++; else if (c === close) depth--; i++; }
      const body = src.slice(re.lastIndex, i - 1); re.lastIndex = i;
      if (['comment', 'string', 'preamble'].includes(kind)) continue;
      const comma = body.indexOf(','); if (comma < 0) continue;
      const key = body.slice(0, comma).trim(); const fields = {};
      let p = comma + 1;
      while (p < body.length) {
        const fm = /\s*([A-Za-z][\w-]*)\s*=\s*/y; fm.lastIndex = p; const f = fm.exec(body);
        if (!f) { const n = body.indexOf(',', p); if (n < 0) break; p = n + 1; continue; }
        p = fm.lastIndex; let val = '';
        if (body[p] === '{') { let d = 1; let j = p + 1; while (j < body.length && d > 0) { if (body[j] === '{') d++; else if (body[j] === '}') d--; j++; } val = body.slice(p + 1, j - 1); p = j; }
        else if (body[p] === '"') { let j = p + 1; let d = 0; while (j < body.length && !(body[j] === '"' && d === 0)) { if (body[j] === '{') d++; else if (body[j] === '}') d--; j++; } val = body.slice(p + 1, j); p = j + 1; }
        else { const mm = /[^,]*/y; mm.lastIndex = p; const t = mm.exec(body)[0]; val = t.trim(); p += t.length; }
        // joined pieces ("a" # "b") are rare; keep the first piece
        const next = body.indexOf(',', p); p = next < 0 ? body.length : next + 1;
        fields[f[1].toLowerCase()] = val;
      }
      out.push(fromBibtex(kind, key, fields));
    }
    return out;
  }
  function fromBibtex(kind, key, f) {
    const g = (k) => (f[k] != null ? clean(f[k]) : '');
    const r = blank(); r._key = key;
    const map = { article: 'article', book: 'book', inbook: 'chapter', incollection: 'chapter', inproceedings: 'conference', conference: 'conference', phdthesis: 'thesis', mastersthesis: 'thesis', techreport: 'report', report: 'report' };
    r.type = map[kind] || ((g('url') && !g('journal') && !g('journaltitle')) ? 'web' : 'other');
    if (kind === 'phdthesis') r.genre = 'Doctoral dissertation'; if (kind === 'mastersthesis') r.genre = "Master's thesis";
    if (r.type === 'thesis' && g('type')) r.genre = g('type');
    r.authors = f.author ? parseNames(f.author) : [];
    if (f.editor) r.editors = parseNames(f.editor);
    const y = g('year') || g('date').slice(0, 4); r.year = (y.match(/\d{4}/) || [''])[0];
    r.title = [g('title'), g('subtitle')].filter(Boolean).join(': ').replace(/([?!.]): /, '$1 ');
    r.container = g('journal') || g('journaltitle') || g('booktitle') || g('website') || '';
    r.volume = g('volume'); r.issue = g('number') && r.type === 'article' ? g('number') : g('issue');
    if (r.type === 'report' && g('number')) r.number = g('number');
    r.pages = g('pages').replace(/\s*[-–—]+\s*/, '–');
    r.publisher = g('publisher') || g('institution') || g('school') || g('organization') || '';
    r.edition = g('edition'); r.doi = g('doi').replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''); r.url = g('url');
    return tidy(r);
  }
  function parseRis(text) {
    const out = []; let cur = null;
    String(text).replace(/\r/g, '').split('\n').forEach((line) => {
      const m = /^([A-Z][A-Z0-9])\s{1,2}-\s?(.*)$/.exec(line); if (!m) return;
      const tag = m[1]; const val = m[2].trim();
      if (tag === 'TY') { cur = { authors: [], editors: [], f: {}, ty: val }; return; }
      if (!cur) return;
      if (tag === 'ER') { out.push(fromRis(cur)); cur = null; return; }
      if (tag === 'AU' || tag === 'A1') cur.authors.push(val);
      else if (tag === 'ED' || tag === 'A2') cur.editors.push(val);
      else if (!(tag in cur.f)) cur.f[tag] = val;
    });
    if (cur) out.push(fromRis(cur));
    return out;
  }
  function fromRis(c) {
    const f = c.f; const r = blank();
    const map = { JOUR: 'article', JFULL: 'article', BOOK: 'book', EBOOK: 'book', CHAP: 'chapter', CONF: 'conference', CPAPER: 'conference', THES: 'thesis', RPRT: 'report', ELEC: 'web', WEB: 'web', BLOG: 'web' };
    r.type = map[c.ty] || 'other';
    const nm = (v) => { const p = parseName(v.includes(',') ? v : v); return p; };
    r.authors = c.authors.map(nm); if (c.editors.length) r.editors = c.editors.map(nm);
    r.year = ((f.PY || f.Y1 || f.DA || '').match(/\d{4}/) || [''])[0];
    r.title = clean(f.TI || f.T1 || '');
    r.container = clean(f.JO || f.JF || f.T2 || f.JA || f.BT || '');
    r.volume = clean(f.VL || ''); r.issue = clean(f.IS || '');
    r.pages = f.SP ? (f.EP ? f.SP + '–' + f.EP : f.SP) : '';
    r.publisher = clean(f.PB || ''); r.edition = clean(f.ET || '');
    r.doi = (f.DO || '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''); r.url = f.UR || '';
    return tidy(r);
  }
  function fromCsl(o) {
    const r = blank();
    const map = { 'article-journal': 'article', article: 'article', book: 'book', chapter: 'chapter', 'paper-conference': 'conference', thesis: 'thesis', report: 'report', webpage: 'web', 'post-weblog': 'web' };
    r.type = map[o.type] || 'other'; r._key = o.id || '';
    const nm = (a) => (a.literal ? { org: a.literal } : { family: a.family || '', given: a.given || '' });
    r.authors = (o.author || []).map(nm); if ((o.editor || []).length) r.editors = o.editor.map(nm);
    const dp = o.issued && o.issued['date-parts'] && o.issued['date-parts'][0]; r.year = dp ? String(dp[0]) : ((o.issued && o.issued.literal || '').match(/\d{4}/) || [''])[0];
    r.title = str(o.title); r.container = str(o['container-title'] || o['event-title'] || '');
    r.volume = str(o.volume); r.issue = str(o.issue); r.pages = str(o.page).replace(/\s*[-–—]+\s*/, '–');
    r.publisher = str(o.publisher); r.edition = str(o.edition); r.doi = str(o.DOI); r.url = str(o.URL);
    if (o.genre) r.genre = str(o.genre); if (r.type === 'report' && o.number) r.number = str(o.number);
    return tidy(r);
  }
  function tidy(r) {
    Object.keys(r).forEach((k) => { if (r[k] === '' || (Array.isArray(r[k]) && !r[k].length)) { if (!['id', 'type', 'authors'].includes(k)) delete r[k]; } });
    r.authors = (r.authors || []).map((a) => { const o = {}; Object.keys(a).forEach((k) => { if (a[k]) o[k] = a[k]; }); return o; }).filter((a) => a.family || a.org);
    if (r.editors) r.editors = r.editors.map((a) => { const o = {}; Object.keys(a).forEach((k) => { if (a[k]) o[k] = a[k]; }); return o; }).filter((a) => a.family || a.org);
    return r;
  }

  /* Reads whatever was pasted: BibTeX, RIS, CSL JSON or a list of DOIs. */
  function parse(text) {
    const t = String(text).trim();
    if (!t) return { items: [], format: '' };
    if (/^[\[{]/.test(t)) {
      try { const j = JSON.parse(t); const arr = Array.isArray(j) ? j : [j]; return { items: arr.map(fromCsl), format: 'CSL JSON' }; } catch (e) { /* not JSON */ }
    }
    if (/^\s*TY\s{1,2}-/m.test(t)) return { items: parseRis(t), format: 'RIS' };
    if (/@\w+\s*[{(]/.test(t)) return { items: parseBibtex(t), format: 'BibTeX' };
    return { items: [], format: '' };
  }
  const DOI_RE = /\b10\.\d{4,9}\/[^\s"<>]+/g;
  const doisIn = (text) => (String(text).match(DOI_RE) || []).map((d) => d.replace(/[.,;)\]]+$/, ''));

  /* A short id: author + year, or the key from the file. */
  function makeId(r, taken) {
    let base = '';
    if (r._key) base = String(r._key).replace(/[^A-Za-z0-9:\-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!/^[A-Za-z0-9]/.test(base)) {
      const a = authors(r)[0];
      const who = a ? (isOrg(a) ? str(a.org).split(/\s+/)[0] : family(a)) : str(r.title).split(/\s+/)[0] || 'ref';
      base = plain(who).replace(/[^a-z0-9]/g, '') + str(r.year).replace(/\D/g, '');
      if (!base) base = 'ref';
    }
    let id = base; let n = 0;
    while (taken.has(id)) { id = base + String.fromCharCode(97 + (n % 26)) + (n >= 26 ? Math.floor(n / 26) : ''); n++; }
    return id;
  }
  function sameWork(a, b) {
    if (a.doi && b.doi && plain(a.doi) === plain(b.doi)) return true;
    return plain(a.title).replace(/\W+/g, '') !== '' && plain(a.title).replace(/\W+/g, '') === plain(b.title).replace(/\W+/g, '') && str(a.year) === str(b.year);
  }
  function problems(r) {
    const p = [];
    if (!authors(r).length) p.push('no author');
    if (!str(r.year)) p.push('no year');
    if (!str(r.title)) p.push('no title');
    if (r.type === 'article' && !str(r.container)) p.push('no journal');
    if (r.type === 'chapter' && !str(r.container)) p.push('no book title');
    return p;
  }
  /* The shortest useful reading of one entry, for pickers: Kloot & Jansen (2020) */
  const shortRef = (r) => label(r).replace(/&amp;/g, '&').replace(/&ldquo;|&rdquo;/g, '"').replace(/<[^>]+>/g, '') + ' (' + yearOf(r) + ')';

  return { TYPES, esc, authors, editors, family, isOrg, yearOf, label, reference, formatGroup, buildDoc, findGroups, itemsOf, suffixes, sortRefs, sortKey, parse, parseBibtex, parseRis, fromCsl, doisIn, makeId, sameWork, problems, shortRef, blank, tidy, ITALIC_TYPES };
})();
