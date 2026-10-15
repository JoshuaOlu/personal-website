'use strict';
/* Overview, projects, writing, publications and CV screens. */

function topActions() {
  const info = S.info;
  const out = [];
  const pv = info && info.preview;
  if (!window.WEB_MODE) out.push(h('button', { type: 'button', class: 'btn secondary small', onclick: (e) => togglePreview(e.currentTarget) }, icon('eye'), pv && pv.running ? 'Preview is on' : 'Start preview'));
  if (pv && pv.running) out.push(h('a', { class: 'btn quiet small', href: pv.url, target: '_blank', rel: 'noopener' }, 'Open ', icon('ext')));
  const n = info && info.git && info.git.changes ? info.git.changes.length : 0;
  out.push(h('a', { class: 'btn small', href: '#/publish' }, icon('upload'), n ? 'Publish (' + n + ')' : 'Publish'));
  return out;
}
async function togglePreview(btn) {
  await busy(btn, async () => {
    const running = S.info && S.info.preview && S.info.preview.running;
    const r = await POST(running ? '/api/preview/stop' : '/api/preview/start');
    await refreshInfo();
    if (!running) { if (r.running) { toast('Preview is running', 'ok'); window.open(r.url, '_blank'); } else toast('The preview did not start. Open "Preview and checks" to see why.', 'bad', 7000); }
    render();
  });
}
const viewUrl = (path) => (S.info && S.info.preview && S.info.preview.running) ? S.info.preview.url.replace(/\/$/, '') + path : siteUrl(path);

/* ── Overview ── */
async function viewHome(view) {
  const info = await refreshInfo();
  const hr = new Date().getHours();
  setTitle((hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + ', ' + (info.site.title || '').split(' ')[0], 'Everything for ' + info.site.url.replace('https://', '') + ' in one place.', topActions());
  const c = info.counts;
  const changes = info.git.repo ? info.git.changes.length : 0;
  const audit = info.last_audit;
  view.append(
    h('div', { class: 'grid cols-4' },
      [['Projects', c.projects, '#/projects'], ['Writing', c.writing, '#/writing'], ['Publications', c.publications, '#/publications'], ['Short links', c.links, '#/links']].map(([l, n, href]) =>
        h('a', { class: 'card stat', href }, h('b', {}, String(n)), h('span', {}, l)))),
    h('div', { class: 'grid cols-2', style: { marginTop: '1rem' } },
      h('div', { class: 'card' },
        h('h2', {}, 'Ready to publish?'),
        h('p', { class: 'sub' }, !info.git.repo ? 'This folder is not connected to Git yet.' : changes ? changes + ' file' + (changes > 1 ? 's' : '') + ' changed on this computer and not yet on the web.' : 'Everything here is already on the web.'),
        h('a', { class: 'btn' + (changes ? '' : ' secondary'), href: '#/publish' }, icon('upload'), changes ? 'Review and publish' : 'Open Publish')),
      h('div', { class: 'card' },
        h('h2', {}, 'Search and AI visibility'),
        audit ? h('div', {}, h('p', { class: 'sub' }, audit.error + ' problems, ' + audit.warn + ' to improve, ' + audit.info + ' suggestions at the last check.'), h('a', { class: 'btn secondary', href: '#/checks' }, icon('check'), 'See the results'))
          : h('div', {}, h('p', { class: 'sub' }, 'Not checked since the console opened. A check builds the site and looks at titles, descriptions, links, structured data and robots rules.'), h('a', { class: 'btn secondary', href: '#/checks' }, icon('check'), 'Check the site')))),
    h('h2', { style: { margin: '2rem 0 .8rem' } }, 'Do something'),
    h('div', { class: 'grid cols-3' },
      tile('pen', 'Write something', 'Start a new piece of writing (saved as a draft).', () => newDocDialog('writing')),
      tile('folder', 'Add a project', 'A new research or project page.', () => newDocDialog('projects')),
      tile('book', 'Add a paper', 'A new publication for the CV and search.', () => go('/publications')),
      tile('link', 'Make a short link', 'A tidy address that forwards, with its own preview.', () => go('/links/new')),
      tile('image', 'Upload a picture', 'Photos, covers and link-preview images.', () => go('/media')),
      tile('user', 'Update the CV', 'Add a role, an award or a certificate.', () => go('/cv'))),
    info.git.repo && info.git.log.length ? h('div', { class: 'card', style: { marginTop: '1.5rem' } }, h('h2', {}, 'Recent saves'),
      h('table', { class: 't' }, h('tbody', {}, info.git.log.map((l) => h('tr', {}, h('td', { class: 't-title' }, l.subject), h('td', { class: 'muted' }, l.when), h('td', { class: 'mono muted' }, l.hash)))))) : null);
}
function tile(ic, title, sub, onclick) {
  return h('button', { type: 'button', class: 'tile', onclick }, icon(ic), h('strong', {}, title), h('span', {}, sub));
}

/* ── Projects and writing: list ── */
const KIND_INFO = {
  projects: { noun: 'project', plural: 'Projects', route: 'projects', blurb: 'Each project is a page under /research/. Order sets which appears first.' },
  writing: { noun: 'piece', plural: 'Writing', route: 'writing', blurb: 'Essays and notes. New pieces start as drafts and stay hidden until you switch them to published.' }
};
async function viewDocList(view, kind) {
  const k = KIND_INFO[kind];
  setTitle(k.plural, k.blurb, topActions());
  const items = (await GET('/api/list?kind=' + kind)).items;
  if (kind === 'projects') items.sort((a, b) => (a.front.order || 50) - (b.front.order || 50));
  else items.sort((a, b) => String(b.front.date || '').localeCompare(String(a.front.date || '')));
  view.append(h('div', { class: 'row between', style: { marginBottom: '1rem' } }, h('span', { class: 'muted' }, items.length + ' ' + (items.length === 1 ? k.noun : k.plural.toLowerCase())),
    h('button', { type: 'button', class: 'btn', onclick: () => newDocDialog(kind) }, icon('plus'), 'New ' + k.noun)));
  if (!items.length) { view.append(h('div', { class: 'empty' }, 'Nothing here yet. Press "New ' + k.noun + '" to start.')); return; }
  view.append(h('div', { class: 'card', style: { padding: 0 } }, h('table', { class: 't' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Title'), h('th', {}, kind === 'projects' ? 'Status' : 'State'), h('th', {}, kind === 'projects' ? 'Order' : 'Date'), h('th', {}, ''))),
    h('tbody', {}, items.map((it) => {
      const fm = it.front;
      const stateChip = kind === 'projects' ? h('span', { class: 'chip ' + (fm.status === 'Recruiting' ? 'signal' : fm.status === 'Completed' ? 'ok' : 'info') }, fm.status || '—')
        : h('span', { class: 'chip ' + (fm.published === false ? 'warn' : 'ok') }, fm.published === false ? 'Draft' : 'Published');
      return h('tr', {},
        h('td', {}, h('a', { class: 't-title', href: '#/' + k.route + '/edit/' + q(it.path), style: { textDecoration: 'none' } }, it.title), it.error ? h('div', { class: 'err small' }, it.error) : h('div', { class: 'small muted mono' }, it.url)),
        h('td', {}, stateChip), h('td', { class: 'muted' }, kind === 'projects' ? String(fm.order == null ? '' : fm.order) : String(fm.date || '')),
        h('td', {}, h('div', { class: 't-actions' }, h('a', { class: 'btn quiet small', href: viewUrl(it.url || '/'), target: '_blank', rel: 'noopener' }, 'View'), h('a', { class: 'btn secondary small', href: '#/' + k.route + '/edit/' + q(it.path) }, 'Edit'))));
    })))));
}
function newDocDialog(kind) {
  const k = KIND_INFO[kind];
  const title = h('input', { type: 'text', placeholder: kind === 'projects' ? 'Name of the project' : 'Title of the piece' });
  const slug = h('input', { type: 'text', placeholder: 'short-name-for-the-address' });
  let slugTouched = false;
  title.addEventListener('input', () => { if (!slugTouched) slug.value = slugify(title.value); });
  slug.addEventListener('input', () => { slugTouched = true; });
  const pathHint = h('div', { class: 'hint' });
  const upd = () => { pathHint.textContent = 'Address: ' + (S.info ? S.info.site.url.replace('https://', '') : '') + (kind === 'projects' ? '/research/' : '/writing/') + (slug.value || '…') + '/'; };
  slug.addEventListener('input', upd); title.addEventListener('input', upd); upd();
  openModal({
    title: 'New ' + k.noun,
    body: h('div', { class: 'stack' }, h('div', { class: 'field' }, h('label', {}, 'Title'), title), h('div', { class: 'field' }, h('label', {}, 'Short name'), slug, pathHint, h('div', { class: 'hint' }, 'This becomes the web address. You cannot change it later without breaking links.'))),
    actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Create', close: false, onclick: async (btn, close) => {
      if (!title.value.trim()) { toast('Please give it a title.', 'bad'); return false; }
      try { const r = await POST('/api/doc/create', { kind, title: title.value.trim(), slug: slug.value || title.value }); close(); go('/' + k.route + '/edit/' + q(r.path)); }
      catch (e) { fail(e); }
      return false;
    } }]
  });
}

/* ── Projects and writing: editor ── */
function quickFieldsFor(kind, pubs) {
  const folded = 'folded';
  if (kind === 'projects') return [
    { k: 'tagline', label: 'Tagline', kind: 'str', wide: true, hint: 'Shown under the title.' },
    { k: 'summary', label: 'Summary for the cards', kind: folded, area: true, wide: true, hint: 'Two sentences for the home and Research pages.' },
    { k: 'description', label: 'Description for Google and link previews', kind: folded, area: true, wide: true, counter: [100, 160], hint: 'About 150 characters. This is the text under your title in search results.' },
    { k: 'seo_title', label: 'Title for Google (optional)', kind: 'str', counter: [30, 60], hint: 'Use the words people search for. Leave empty to use the page title.' },
    { k: 'status', label: 'Status', kind: 'str', options: PROJECT_STATUSES },
    { k: 'period', label: 'Period', kind: 'str', hint: 'For example 2026 to 2027.' },
    { k: 'order', label: 'Order on the pages', kind: 'num', hint: 'Lowest number comes first.' },
    { k: 'updated', label: 'Last updated', kind: 'date' },
    { k: 'cover', label: 'Cover picture (top right)', kind: 'str', picker: true },
    { k: 'cover_alt', label: 'Describe the cover picture', kind: 'str' },
    { k: 'image.path', label: 'Link-preview picture (1200 × 630)', kind: 'str', picker: true, nested: ['image', 'path'] },
    { k: 'image.alt', label: 'Describe the link-preview picture', kind: 'str', nested: ['image', 'alt'] },
    { k: 'publications', label: 'Papers shown on this project', kind: 'list', pubs: pubs, wide: true }
  ];
  return [
    { k: 'summary', label: 'Summary', kind: folded, area: true, wide: true, hint: 'One or two sentences saying what the piece argues. Shown in the list.' },
    { k: 'description', label: 'Description for Google and link previews', kind: folded, area: true, wide: true, counter: [100, 160], hint: 'About 150 characters.' },
    { k: 'date', label: 'Date', kind: 'date' },
    { k: 'updated', label: 'Updated on (optional)', kind: 'date' },
    { k: 'tags', label: 'Tags (separate with commas)', kind: 'list', csv: true, wide: true },
    { k: 'canonical_url', label: 'First published elsewhere? Its address', kind: 'str', wide: true, hint: 'Only fill this if the piece appeared first on another site (for example Substack). Search engines will then credit that page.' },
    { k: 'seo_title', label: 'Title for Google (optional)', kind: 'str', counter: [30, 60] },
    { k: 'card_topic', label: 'Topic on the preview card (optional)', kind: 'str', hint: 'Defaults to the first tag.' },
    { k: 'image.path', label: 'Your own link-preview picture (optional, 1200 × 630)', kind: 'str', picker: true, nested: ['image', 'path'], hint: 'Leave empty and the site makes a card from your title, topic and name.' },
    { k: 'image.alt', label: 'Describe the picture', kind: 'str', nested: ['image', 'alt'] }
  ];
}
function getPath(obj, def) {
  if (def.nested) return obj && obj[def.nested[0]] ? obj[def.nested[0]][def.nested[1]] : '';
  return obj ? obj[def.k] : '';
}

const cardTier = (n) => (n <= 34 ? 't1' : n <= 58 ? 't2' : n <= 82 ? 't3' : 't4');
function ogCardEl(title, topic) {
  const wrap = h('div', { class: 'ogc-wrap' });
  const site = (S.info && S.info.site) || {};
  const card = h('div', { class: 'ogc ' + cardTier(title.length) },
    h('div', { class: 'ogc-topic' }, topic), h('h1', { class: 'ogc-title' }, title),
    h('div', { class: 'ogc-foot' }, h('img', { class: 'ogc-photo', src: mediaUrl('/assets/images/headshot.jpg'), alt: '' }),
      h('div', {}, h('div', { class: 'ogc-name' }, site.title || ''), h('div', { class: 'ogc-role' }, 'Engineering education, Nigeria & Africa')),
      h('div', { class: 'ogc-url' }, (site.url || '').replace('https://', ''))));
  wrap.append(card);
  const fit = () => { const w = wrap.clientWidth; if (w) card.style.transform = 'scale(' + (w / 1200) + ')'; };
  if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap); else setTimeout(fit, 50);
  return wrap;
}

async function viewDocEdit(view, kind, path) {
  const k = KIND_INFO[kind];
  const doc = await GET('/api/doc?path=' + q(path));
  const pubs = kind === 'projects' ? ((await GET('/api/data?name=publications')).data || []) : [];
  let fm = doc.front_raw; let body = doc.body; let parsed = doc.front; let mtime = doc.mtime;
  const orig = { fm, body };
  let yamlOk = true;
  const siteTitle = S.info.site.title;
  setTitle(parsed.title || path, k.plural + ' · ' + path, topActions());

  const titleInput = h('input', { type: 'text', class: 'title-input', value: parsed.title || '', placeholder: 'Title', 'aria-label': 'Title' });
  const titleHint = h('div', { class: 'small muted', style: { marginTop: '.4rem' } });
  const yamlArea = h('textarea', { class: 'yaml-area', spellcheck: 'false', rows: 18, value: fm });
  const yamlErr = h('div', { class: 'err' });
  const bodyArea = h('textarea', { spellcheck: 'true', value: body, rows: 24 });
  const previewPane = h('div', { class: 'md-preview', hidden: true });
  const msg = h('div', { class: 'small muted' }, 'All changes saved');
  const saveBtn = h('button', { type: 'button', class: 'btn', disabled: true }, 'Save');
  const inputs = [];

  const serp = { u: h('div', { class: 'u' }), ti: h('div', { class: 'ti' }), ds: h('div', { class: 'ds' }) };
  const share = { img: h('div', { class: 'img' }, 'No picture chosen'), t: h('b'), d: h('span'), dom: h('small') };
  function refreshPreviews() {
    const title = parsed.seo_title ? parsed.seo_title + ' | ' + siteTitle : (parsed.title || '') + ' | ' + siteTitle;
    serp.ti.textContent = title.length > 62 ? title.slice(0, 60) + '…' : title;
    const slug = path.split('/').pop().replace(/\.[^.]+$/, '');
    const url = (kind === 'projects' ? (parsed.permalink || '/research/' + slug + '/') : (parsed.permalink || '/writing/' + slug + '/'));
    serp.u.textContent = S.info.site.url.replace('https://', '') + url.replace(/\/$/, '').split('/').filter(Boolean).map((x) => ' › ' + x).join('');
    const d = String(parsed.description || parsed.summary || '').replace(/\s+/g, ' ').trim();
    serp.ds.textContent = d ? (d.length > 160 ? d.slice(0, 158) + '…' : d) : 'No description yet. Google will pick a snippet from the page.';
    const imgPath = (parsed.image && (parsed.image.path || parsed.image)) || '/assets/images/og-default.png';
    clear(share.img);
    if (kind === 'writing' && !parsed.image && parsed.card !== false) {
      const t = String(parsed.title || 'Your title appears here').trim();
      share.img.append(ogCardEl(t, String(parsed.card_topic || (Array.isArray(parsed.tags) && parsed.tags[0]) || 'Essay')));
      const n = String(parsed.title || '').trim().length;
      titleHint.textContent = n + ' characters. ' + (n <= 70 ? 'A good length for the preview card.' : n <= 90 ? 'A bit long: the card will use smaller type.' : 'Too long: the card will trim it. Shorten it if you can.');
      titleHint.style.color = n > 90 ? 'var(--danger)' : n > 70 ? 'var(--warn)' : '';
    } else {
      if (typeof imgPath === 'string') share.img.append(h('img', { src: mediaUrl(imgPath), alt: '' }));
      titleHint.textContent = '';
    }
    share.t.textContent = parsed.title || ''; share.d.textContent = d.slice(0, 120); share.dom.textContent = S.info.site.url.replace('https://', '');
  }
  function markDirty() {
    const changed = fm !== orig.fm || bodyArea.value !== orig.body;
    setDirty(changed && yamlOk);
    msg.textContent = !yamlOk ? 'The front matter has a mistake (see below)' : changed ? 'You have unsaved changes' : 'All changes saved';
    msg.className = 'small ' + (!yamlOk ? 'err' : changed ? '' : 'muted');
    saveBtn.disabled = !changed || !yamlOk;
  }
  function applyField(def, val) {
    if (def.nested) fm = setNested(fm, def.nested[0], def.nested[1], def.kind === 'num' ? 'num' : 'str', val);
    else fm = setField(fm, def.k, def.kind, val);
    yamlArea.value = fm;
    // keep our own picture of the data in step with the text
    if (def.nested) { parsed[def.nested[0]] = parsed[def.nested[0]] || {}; if (val === '' || val == null) delete parsed[def.nested[0]][def.nested[1]]; else parsed[def.nested[0]][def.nested[1]] = val; }
    else if (val === '' || val == null) delete parsed[def.k]; else parsed[def.k] = val;
    refreshPreviews(); markDirty();
  }

  titleInput.addEventListener('input', () => { fm = setField(fm, 'title', 'str', titleInput.value); parsed.title = titleInput.value; yamlArea.value = fm; refreshPreviews(); markDirty(); });

  const defs = quickFieldsFor(kind, pubs);
  const fieldsEl = h('div', { class: 'fields' });
  defs.forEach((def) => {
    let control; const cur = getPath(parsed, def);
    if (def.pubs) {
      const chosen = new Set(Array.isArray(cur) ? cur : []);
      control = h('div', { class: 'stack' }, pubs.length ? pubs.map((p) => {
        const cb = h('input', { type: 'checkbox', checked: chosen.has(p.id), onchange: () => { cb.checked ? chosen.add(p.id) : chosen.delete(p.id); applyField(def, pubs.map((x) => x.id).filter((id) => chosen.has(id))); } });
        return h('label', { class: 'toggle', style: { fontWeight: 500 } }, cb, h('span', {}, p.title || p.id, h('small', { class: 'muted' }, ' · ' + p.year)));
      }) : h('p', { class: 'muted' }, 'No papers yet. Add them on the Publications page.'));
    } else if (def.picker) {
      const inp = h('input', { type: 'text', value: cur || '', placeholder: '/assets/images/…', oninput: () => { applyField(def, inp.value); thumb.src = inp.value ? mediaUrl(inp.value) : ''; thumb.hidden = !inp.value; } });
      const thumb = h('img', { class: 'thumb-s', src: cur ? mediaUrl(cur) : '', alt: '', hidden: !cur });
      control = h('div', { class: 'pick-row' }, thumb, inp, h('button', { type: 'button', class: 'btn secondary small', onclick: () => pickMedia((m) => {
        inp.value = m.path; thumb.src = mediaUrl(m.path); thumb.hidden = false;
        applyField(def, m.path);
        if (def.k === 'image.path' && m.width) { fm = setNested(fm, 'image', 'width', 'num', m.width); fm = setNested(fm, 'image', 'height', 'num', m.height); yamlArea.value = fm; markDirty(); }
      }) }, 'Choose…'));
      inputs.push({ def, el: inp });
    } else if (def.options) {
      const dl = 'dl' + def.k.replace(/\W/g, '');
      const inp = h('input', { type: 'text', value: cur || '', list: dl, oninput: () => applyField(def, inp.value) });
      control = h('div', {}, inp, h('datalist', { id: dl }, def.options.map((o) => h('option', { value: o }))));
      inputs.push({ def, el: inp });
    } else if (def.area) {
      const ta = h('textarea', { rows: 3, value: cur || '', oninput: () => applyField(def, ta.value.replace(/\s*\n\s*/g, ' ')) });
      control = h('div', {}, ta, def.counter ? counterFor(def, ta) : null);
      inputs.push({ def, el: ta });
    } else if (def.csv) {
      const inp = h('input', { type: 'text', value: Array.isArray(cur) ? cur.join(', ') : '', oninput: () => applyField(def, inp.value.split(',').map((x) => x.trim()).filter(Boolean)) });
      control = inp; inputs.push({ def, el: inp });
    } else {
      const type = def.kind === 'date' ? 'date' : def.kind === 'num' ? 'number' : 'text';
      const inp = h('input', { type, value: cur == null ? '' : String(cur), oninput: () => applyField(def, def.kind === 'num' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value) });
      control = h('div', {}, inp, def.counter ? counterFor(def, inp) : null); inputs.push({ def, el: inp });
    }
    fieldsEl.append(h('div', { class: 'field' + (def.wide ? ' wide' : '') }, h('div', { class: 'lbl' }, def.label), control, def.hint ? h('div', { class: 'hint' }, def.hint) : null));
  });

  // published switch for writing
  let pubToggle = null;
  if (kind === 'writing') {
    const cb = h('input', { type: 'checkbox', checked: parsed.published !== false, onchange: () => { fm = setField(fm, 'published', 'bool', cb.checked); parsed.published = cb.checked; yamlArea.value = fm; markDirty(); lab.textContent = cb.checked ? 'Published: visitors can read it' : 'Draft: hidden from visitors'; } });
    const lab = h('span', {}, parsed.published !== false ? 'Published: visitors can read it' : 'Draft: hidden from visitors');
    pubToggle = h('label', { class: 'toggle' }, cb, lab);
  }

  // markdown toolbar
  const wrap = (before, after = before) => () => {
    const a = bodyArea; const s = a.selectionStart; const e = a.selectionEnd; const sel = a.value.slice(s, e) || 'text';
    a.setRangeText(before + sel + after, s, e, 'select'); a.focus(); onBody();
  };
  const linePrefix = (pre) => () => {
    const a = bodyArea; const s = a.selectionStart; const start = a.value.lastIndexOf('\n', s - 1) + 1;
    a.setRangeText(pre, start, start, 'end'); a.focus(); onBody();
  };
  const onBody = () => { body = bodyArea.value; markDirty(); if (!previewPane.hidden) previewPane.innerHTML = miniMarkdown(bodyArea.value); };
  bodyArea.addEventListener('input', onBody);
  let previewing = false;
  const modeBtn = h('button', { type: 'button', class: 'btn quiet', onclick: () => {
    previewing = !previewing; previewPane.hidden = !previewing; bodyArea.hidden = previewing; modeBtn.textContent = previewing ? 'Back to writing' : 'Rough preview';
    if (previewing) previewPane.innerHTML = miniMarkdown(bodyArea.value);
  } }, 'Rough preview');
  const insertBlock = (text) => { const a = bodyArea; const s0 = a.selectionStart; const before = a.value.slice(0, s0); const lead = before.length && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''; a.setRangeText(lead + text + '\n\n', s0, a.selectionEnd, 'end'); a.focus(); onBody(); };
  const escAttr = (v) => String(v || '').replace(/"/g, '&quot;');
  const insertPicture = () => pickMedia((m) => {
    const alt = h('input', { type: 'text', placeholder: 'Describe the picture for people who cannot see it' });
    const cap = h('input', { type: 'text', placeholder: 'Caption (optional)' });
    openModal({ title: 'Insert picture', body: h('div', { class: 'stack' }, h('img', { src: mediaUrl(m.path), alt: '', style: { maxHeight: '180px', borderRadius: '8px' } }),
      h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Description (alt text)'), alt), h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Caption'), cap)),
      actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Insert', onclick: () => {
        if (!alt.value.trim()) { toast('Add a short description. It helps people using screen readers and helps Google.', 'bad'); return false; }
        insertBlock('<figure><img src="{{ \'' + m.path + '\' | relative_url }}" alt="' + escAttr(alt.value.trim()) + '"' + (m.width ? ' width="' + m.width + '" height="' + m.height + '"' : '') + ' loading="lazy">' + (cap.value.trim() ? '<figcaption>' + cap.value.trim().replace(/</g, '&lt;') + '</figcaption>' : '') + '</figure>');
      } }] });
  });
  const insertEmbed = () => {
    const url = h('input', { type: 'url', placeholder: 'https://youtu.be/…  or a Spotify, Vimeo, SoundCloud, Apple Podcasts link' });
    const cap = h('input', { type: 'text', placeholder: 'Caption (optional)' });
    openModal({ title: 'Embed from another site', body: h('div', { class: 'stack' },
      h('p', { class: 'sub' }, 'Paste the address from the browser. Works with YouTube, Vimeo, Spotify, SoundCloud, Apple Podcasts and Music, Mixcloud, Loom, TED, Dailymotion, Google Drive, Google Slides and Internet Archive. A link to an .mp3 or .mp4 file gets a simple player. Anything else becomes a link. Nothing loads until the reader presses play.'),
      h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Address'), url), h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Caption'), cap)),
      actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Insert', onclick: () => {
        const u = url.value.trim();
        if (!/^https:\/\//.test(u)) { toast('The address must start with https://', 'bad'); return false; }
        insertBlock('{% include embed.html url="' + escAttr(u) + '"' + (cap.value.trim() ? ' caption="' + escAttr(cap.value.trim()) + '"' : '') + ' %}');
      } }] });
  };
  const insertPullQuote = () => { const a = bodyArea; const sel = a.value.slice(a.selectionStart, a.selectionEnd) || 'The sentence you want readers to remember.'; insertBlock('> ' + sel.replace(/\n+/g, ' ') + '\n{: .pullquote}'); };
  const insertFootnote = () => {
    const a = bodyArea; const n = (a.value.match(/\[\^(\d+)\]:/g) || []).length + 1;
    a.setRangeText('[^' + n + ']', a.selectionStart, a.selectionEnd, 'end');
    a.value = a.value.replace(/\s*$/, '') + '\n\n[^' + n + ']: Footnote text.\n'; a.focus(); onBody();
  };
  const tools = h('div', { class: 'md-tools' },
    h('button', { type: 'button', class: 'btn quiet', onclick: wrap('**'), title: 'Bold' }, h('b', {}, 'B')),
    h('button', { type: 'button', class: 'btn quiet', onclick: wrap('*'), title: 'Italic' }, h('i', {}, 'I')),
    h('button', { type: 'button', class: 'btn quiet', onclick: () => { const a = bodyArea; const s = a.selectionStart; const e = a.selectionEnd; const sel = a.value.slice(s, e) || 'link text'; a.setRangeText('[' + sel + '](https://)', s, e, 'end'); a.focus(); onBody(); }, title: 'Link' }, 'Link'),
    h('button', { type: 'button', class: 'btn quiet', onclick: linePrefix('## '), title: 'Heading' }, 'Heading'),
    h('button', { type: 'button', class: 'btn quiet', onclick: linePrefix('- '), title: 'Bullet list' }, 'List'),
    h('button', { type: 'button', class: 'btn quiet', onclick: linePrefix('> '), title: 'Quote' }, 'Quote'),
    h('button', { type: 'button', class: 'btn quiet', onclick: insertPicture, title: 'Insert a picture with caption' }, 'Picture'),
    h('button', { type: 'button', class: 'btn quiet', onclick: insertEmbed, title: 'Embed a video, audio or slides from another site' }, 'Embed'),
    h('button', { type: 'button', class: 'btn quiet', onclick: insertPullQuote, title: 'Large highlighted quote' }, 'Pull quote'),
    h('button', { type: 'button', class: 'btn quiet', onclick: insertFootnote, title: 'Footnote' }, 'Footnote'),
    h('span', { class: 'spacer' }), modeBtn);

  // the raw front matter
  const reparse = debounce(async () => {
    try {
      const r = await POST('/api/yaml/parse', { text: fm });
      if (r.ok) {
        yamlOk = true; yamlErr.textContent = ''; parsed = r.data || {};
        inputs.forEach(({ def, el }) => { if (document.activeElement !== el) { const v = getPath(parsed, def); el.value = Array.isArray(v) ? v.join(', ') : (v == null ? '' : v); } });
        if (document.activeElement !== titleInput) titleInput.value = parsed.title || '';
        refreshPreviews();
      } else { yamlOk = false; yamlErr.textContent = r.error; }
    } catch (e) { yamlOk = false; yamlErr.textContent = e.message; }
    markDirty();
  }, 350);
  yamlArea.addEventListener('input', () => { fm = yamlArea.value; markDirty(); reparse(); });
  yamlArea.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); const a = yamlArea; a.setRangeText('  ', a.selectionStart, a.selectionEnd, 'end'); fm = a.value; markDirty(); } });

  saveBtn.onclick = () => busy(saveBtn, async () => {
    const r = await PUT('/api/doc', { path, front_raw: fm, body: bodyArea.value, mtime, has_front: true });
    mtime = r.mtime; orig.fm = fm; orig.body = bodyArea.value; setDirty(false); markDirty();
    toast('Saved', 'ok');
    await refreshInfo();
  }, 'Saving…');
  const keyHandler = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!saveBtn.disabled) saveBtn.click(); } };
  document.addEventListener('keydown', keyHandler);
  onLeave(() => document.removeEventListener('keydown', keyHandler));

  const delBtn = h('button', { type: 'button', class: 'btn danger small', onclick: async () => {
    if (await confirmDialog('Delete this ' + k.noun + '?', '"' + (parsed.title || path) + '" will be removed from your site. A backup copy is kept on this computer.', 'Delete it', true)) {
      await busy(null, async () => { await POST('/api/doc/delete', { path }); setDirty(false); toast('Deleted'); go('/' + k.route); });
    }
  } }, icon('trash'), 'Delete');

  refreshPreviews(); markDirty();
  view.append(h('div', { class: 'editor' },
    h('div', { class: 'stack' },
      h('div', { class: 'card' }, titleInput, kind === 'writing' ? titleHint : null, pubToggle ? h('div', { style: { marginTop: '1rem' } }, pubToggle) : null, h('div', { style: { marginTop: '1.2rem' } }, fieldsEl)),
      h('div', { class: 'card' }, h('h2', {}, 'The page itself'), h('p', { class: 'sub' }, 'Written in Markdown. Use the buttons above the box, or type the marks yourself.'),
        h('div', { class: 'md-wrap' }, tools, bodyArea, previewPane)),
      h('details', { class: 'card' }, h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Advanced: everything at the top of the file (front matter)'),
        h('p', { class: 'sub', style: { marginTop: '.6rem' } }, 'This is where the "At a glance" box, the progress timeline and the list of outputs live. The boxes above edit the same text.'), yamlArea, yamlErr)),
    h('div', { class: 'editor-side' },
      h('div', { class: 'card' }, h('div', { class: 'row' }, saveBtn, h('a', { class: 'btn secondary', href: viewUrl(S.info ? (doc.url || '/') : '/'), target: '_blank', rel: 'noopener' }, 'View page ', icon('ext'))), h('div', { style: { marginTop: '.7rem' } }, msg), h('div', { style: { marginTop: '1rem' } }, delBtn)),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'In Google'), h('div', { class: 'serp' }, serp.u, serp.ti, serp.ds)),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'When shared on LinkedIn'), h('div', { class: 'share-card' }, share.img, h('div', { class: 'meta' }, share.dom, share.t, share.d))))));
}

/* ── Publications and CV ── */
async function viewPublications(view) {
  setTitle('Publications', 'Add each paper once. Everything else is built from this list.', topActions());
  await dataPage(view, {
    name: 'publications', root: 'array', fields: SCHEMA.publications,
    validate: (items) => {
      const ids = items.map((i) => i.id).filter(Boolean);
      const dup = ids.find((id, i) => ids.indexOf(id) !== i);
      if (dup) return ['The ID "' + dup + '" is used twice. Each paper needs its own.'];
      const bad = items.find((i) => !i.id || !/^[a-z0-9][a-z0-9-]*$/.test(i.id));
      return bad ? ['A paper needs a short ID in lowercase letters, numbers and dashes.'] : [];
    }
  });
}
async function viewCV(view) {
  setTitle('Curriculum vitae', 'One file feeds the web page and the PDF.', topActions());
  await dataPage(view, {
    name: 'cv', fields: SCHEMA.cv,
    intro: 'Edit here and both the web CV and the PDF update when you publish. The "Last updated" date is set to today each time you save.',
    headerExtra: h('div', { class: 'row', style: { marginBottom: '1rem' } }, h('a', { class: 'btn secondary small', target: '_blank', rel: 'noopener', href: viewUrl('/cv/') }, 'View the CV page ', icon('ext')))
  });
}
