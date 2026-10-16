'use strict';
/* References: your library of sources, adding them (BibTeX, RIS, DOI or by hand), and the Cite picker. */

async function loadRefs() {
  const r = await GET('/api/data?name=references');
  return Array.isArray(r.data) ? r.data : [];
}
async function saveRefs(list) {
  await PUT('/api/data?name=references', { data: list });
}
const REF_ID_OK = /^[A-Za-z0-9][A-Za-z0-9:-]*$/;

/* Which pieces cite which sources: { id: [titles] } */
async function refUsage() {
  const use = {};
  for (const kind of ['writing', 'projects']) {
    let items = [];
    try { items = (await GET('/api/list?kind=' + kind)).items || []; } catch (e) { continue; }
    for (const it of items) {
      try {
        const d = await GET('/api/doc?path=' + q(it.path));
        Refs.findGroups(d.body || '').forEach((g) => Refs.itemsOf(g.slice(1, -1)).forEach((i) => {
          const t = (d.front && d.front.title) || it.path;
          use[i.key] = use[i.key] || []; if (!use[i.key].includes(t)) use[i.key].push(t);
        }));
      } catch (e) { /* skip */ }
    }
  }
  return use;
}

const authorsToText = (list) => (list || []).map((a) => (a.org ? a.org : (a.given ? a.family + ', ' + a.given : a.family))).join('\n');
function textToAuthors(t) {
  return String(t || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    if (l.includes(',')) { const i = l.indexOf(','); return { family: l.slice(0, i).trim(), given: l.slice(i + 1).trim() }; }
    return { org: l };
  });
}
const cleanRec = (r) => { const o = {}; Object.keys(r).forEach((k) => { if (k[0] === '_') return; const v = r[k]; if (v === '' || v == null || (Array.isArray(v) && !v.length)) return; o[k] = typeof v === 'number' ? String(v) : v; }); if (!o.type) o.type = 'other'; return o; };
const orderRec = (r) => { const order = ['id', 'type', 'authors', 'editors', 'year', 'title', 'container', 'volume', 'issue', 'pages', 'edition', 'publisher', 'number', 'genre', 'doi', 'url']; const o = {}; order.forEach((k) => { if (k in r) o[k] = r[k]; }); Object.keys(r).forEach((k) => { if (!(k in o)) o[k] = r[k]; }); return o; };

/* ── the add / edit form ── */
function openReferenceForm(existing, onSaved, library) {
  const isNew = !existing;
  const rec = existing ? JSON.parse(JSON.stringify(existing)) : Refs.blank();
  if (isNew) rec.type = 'article';
  const preview = h('div', { class: 'ref-preview' });
  const refresh = () => { const r = cleanRec(rec); preview.innerHTML = r.title || (r.authors && r.authors.length) ? Refs.reference(r, '') : '<span class="muted">The reference appears here as you type.</span>'; };
  const wrap = h('div', { class: 'stack' });
  const rows = [];
  const labelFor = { container: { article: 'Journal', chapter: 'Book title', conference: 'Proceedings or event', web: 'Website name', other: 'Where it appeared (optional)' }, publisher: { thesis: 'University', report: 'Organisation that published it', web: '', other: 'Publisher' } };
  const show = {
    editors: ['chapter'], container: ['article', 'chapter', 'conference', 'web', 'other'], volume: ['article'], issue: ['article'], pages: ['article', 'chapter', 'conference'],
    edition: ['book', 'chapter'], publisher: ['book', 'chapter', 'conference', 'thesis', 'report', 'other'], number: ['report'], genre: ['thesis']
  };
  const field = (key, label, el, hint) => { const box = h('div', { class: 'field', 'data-key': key }, h('div', { class: 'lbl' }, label), el, hint ? h('div', { class: 'hint' }, hint) : null); rows.push({ key, box, label: box.firstChild }); return box; };
  const text = (key, ph) => { const i = h('input', { type: 'text', value: rec[key] == null ? '' : String(rec[key]), placeholder: ph || '', oninput: () => { rec[key] = i.value; refresh(); } }); return i; };
  const typeSel = h('select', { onchange: () => { rec.type = typeSel.value; layout(); refresh(); } }, Refs.TYPES.map(([v, l]) => h('option', { value: v, selected: rec.type === v }, l)));
  const authorsTa = h('textarea', { rows: 3, placeholder: 'Kloot, Bruce\nJansen, Lauren', value: authorsToText(rec.authors), oninput: () => { rec.authors = textToAuthors(authorsTa.value); refresh(); } });
  const editorsTa = h('textarea', { rows: 2, value: authorsToText(rec.editors), oninput: () => { rec.editors = textToAuthors(editorsTa.value); refresh(); } });
  const idInput = h('input', { type: 'text', value: rec.id || '', placeholder: 'made for you, for example kloot2020', readOnly: !isNew });
  idInput.addEventListener('input', () => { rec.id = idInput.value.trim(); });
  wrap.append(
    field('type', 'What kind of source is it?', typeSel),
    field('authors', 'Authors', authorsTa, 'One per line, as Family, Given. For an organisation write just its name (for example UNESCO). Leave empty if there is no author.'),
    field('editors', 'Editors', editorsTa, 'One per line, same way.'),
    field('year', 'Year', text('year', '2020')),
    field('title', 'Title', text('title')),
    field('container', 'Journal', text('container')),
    field('volume', 'Volume', text('volume')), field('issue', 'Issue', text('issue')), field('pages', 'Pages', text('pages', '345-360')),
    field('edition', 'Edition', text('edition', '2nd')), field('publisher', 'Publisher', text('publisher')),
    field('number', 'Report number', text('number')), field('genre', 'Kind of thesis', text('genre', "Master's thesis")),
    field('doi', 'DOI', text('doi', '10.1000/xyz123')), field('url', 'Web address', text('url', 'https://')),
    field('id', 'Short name for citing', idInput, isNew ? 'Optional. You cite with [@this-name]. It cannot be changed later because pieces already use it.' : 'You cite this with [@' + (rec.id || '') + ']. To rename it, add it again and delete this one.'));
  function layout() {
    rows.forEach(({ key, box, label }) => {
      if (show[key]) box.hidden = !show[key].includes(rec.type);
      if (labelFor[key]) { const l = labelFor[key][rec.type] != null ? labelFor[key][rec.type] : (key === 'publisher' ? 'Publisher' : label.textContent); label.textContent = l; if (l === '' ) box.hidden = true; }
    });
  }
  layout(); refresh();
  openModal({ title: isNew ? 'Add a reference' : 'Edit reference', wide: true,
    body: h('div', { class: 'stack' }, wrap, h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'How it will look in your reference list'), preview)),
    actions: [{ label: 'Cancel', kind: 'secondary' }, { label: isNew ? 'Add it' : 'Save', onclick: async () => {
      const r = cleanRec(rec);
      if (!r.title) { toast('A title is needed.', 'bad'); return false; }
      const list = library ? library.slice() : await loadRefs();
      if (isNew) {
        const taken = new Set(list.map((x) => String(x.id)));
        if (r.id) { if (!REF_ID_OK.test(r.id)) { toast('The short name can only use letters, numbers, - and :', 'bad'); return false; } if (taken.has(r.id)) { toast('That short name is already used.', 'bad'); return false; } }
        else r.id = Refs.makeId(r, taken);
        list.push(orderRec(r));
      } else {
        const i = list.findIndex((x) => x.id === existing.id); r.id = existing.id; if (i >= 0) list[i] = orderRec(r); else list.push(orderRec(r));
      }
      await saveRefs(list); toast('Saved', 'ok'); if (onSaved) await onSaved(r.id);
    } }] });
}

/* ── add from BibTeX, RIS, CSL JSON or DOI ── */
function openImport(onDone) {
  const ta = h('textarea', { rows: 9, placeholder: 'Paste BibTeX, RIS or CSL JSON here.\n\nMost databases and publishers have an "Export citation" button. Zotero, Mendeley, EndNote, Google Scholar and Crossref all export one of these.', spellcheck: 'false' });
  const file = h('input', { type: 'file', accept: '.bib,.bibtex,.ris,.json,.txt,text/plain,application/json' });
  const status = h('div', { class: 'small muted' });
  const results = h('div', { class: 'stack', style: { marginTop: '.8rem' } });
  let found = []; let library = [];
  const readBtn = h('button', { type: 'button', class: 'btn secondary' }, 'Read it');
  file.addEventListener('change', () => { const f = file.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { ta.value = String(fr.result); readBtn.click(); }; fr.readAsText(f); });
  async function lookupDois(dois) {
    const out = [];
    for (let i = 0; i < dois.length; i++) {
      status.textContent = 'Looking up ' + (i + 1) + ' of ' + dois.length + '…';
      try { const j = await POST('/api/refs/doi', { doi: dois[i] }); out.push(Refs.fromCsl(j.csl)); }
      catch (e) { toast('Could not find ' + dois[i] + ': ' + e.message, 'bad', 6000); }
    }
    return out;
  }
  async function show() {
    library = await loadRefs();
    clear(results);
    if (!found.length) { results.append(h('p', { class: 'muted' }, 'Nothing could be read from that. Check it is BibTeX, RIS or CSL JSON' + (window.WEB_MODE ? '.' : ', or paste DOIs one per line.'))); return; }
    const taken = new Set(library.map((x) => String(x.id)));
    const rows = found.map((r) => {
      const dup = library.find((x) => Refs.sameWork(x, r));
      const probs = Refs.problems(r);
      const cb = h('input', { type: 'checkbox', checked: !dup, disabled: !!dup });
      return { r, dup, cb, el: h('label', { class: 'imp-row' + (dup ? ' dup' : '') }, cb, h('div', {}, h('div', { html: Refs.reference(r, '') }),
        dup ? h('div', { class: 'small muted' }, 'Already in your library') : null,
        probs.length ? h('div', { class: 'small', style: { color: 'var(--warn)' } }, 'Check: ' + probs.join(', ')) : null)) };
    });
    results.append(h('div', { class: 'small muted' }, found.length + ' found (' + (status.dataset.format || 'text') + '). Tick the ones to add.'), h('div', { class: 'imp-list' }, rows.map((x) => x.el)));
    results._rows = rows; results._taken = taken;
  }
  readBtn.onclick = async () => {
    const t = ta.value.trim(); status.textContent = '';
    if (!t) { toast('Paste something first.', 'bad'); return; }
    const p = Refs.parse(t); status.dataset.format = p.format; found = p.items;
    if (!found.length && !window.WEB_MODE) { const d = Refs.doisIn(t); if (d.length) { status.dataset.format = 'DOI'; found = await lookupDois(d.slice(0, 40)); status.textContent = ''; } }
    await show();
  };
  const body = h('div', { class: 'stack' }, h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Paste or choose a file'), ta, h('div', { class: 'row', style: { marginTop: '.5rem' } }, readBtn, file)),
    window.WEB_MODE ? h('p', { class: 'small muted' }, 'Looking up a DOI needs the console on your computer. Here, paste BibTeX or RIS (publishers offer an Export citation button).') : h('p', { class: 'small muted' }, 'You can also paste DOIs (one per line, for example 10.1002/jee.20321) and the console looks them up.'),
    status, results);
  openModal({ title: 'Add references', wide: true, body, actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Add the ticked ones', onclick: async () => {
    const rows = (results._rows || []).filter((x) => x.cb.checked && !x.dup);
    if (!rows.length) { toast('Nothing ticked.', 'bad'); return false; }
    const list = (await loadRefs()); const taken = new Set(list.map((x) => String(x.id)));
    rows.forEach((x) => { const r = cleanRec(x.r); r.id = Refs.makeId(Object.assign({ _key: x.r._key }, r), taken); taken.add(r.id); list.push(orderRec(r)); });
    await saveRefs(list); toast(rows.length + ' reference' + (rows.length === 1 ? '' : 's') + ' added', 'ok'); if (onDone) await onDone();
  } }] });
}

/* ── the References page ── */
async function viewReferences(view) {
  setTitle('References', 'Your sources. Cite them in a piece with [@name] and the list builds itself.', topActions());
  let list = await loadRefs();
  const search = h('input', { type: 'text', placeholder: 'Search by author, title, year…', 'aria-label': 'Search references' });
  const box = h('div', { class: 'ref-list-ui' });
  let usage = null;
  async function reload() { list = await loadRefs(); draw(); S.refs = list; }
  function draw() {
    clear(box);
    const term = plainText(search.value);
    const shown = Refs.sortRefs(list).filter((r) => !term || plainText([Refs.authors(r).map((a) => a.family || a.org).join(' '), r.title, r.year, r.id, r.container].join(' ')).includes(term));
    if (!list.length) {
      box.append(h('div', { class: 'card' }, h('h2', {}, 'No references yet'),
        h('p', { class: 'sub' }, 'Add your sources once, then cite them in any piece. The reference list at the end (APA style) is built and kept in order for you.'),
        h('ol', { class: 'steps-list' }, h('li', {}, 'Press "Add references" and paste BibTeX or RIS from Zotero, Mendeley, Google Scholar or a publisher, or choose the file.' + (window.WEB_MODE ? '' : ' You can also paste a DOI.')), h('li', {}, 'In a piece, press Cite and pick the source (or type [@name]).'), h('li', {}, 'Publish. In-text citations such as (Kloot & Jansen, 2020) and the list of references appear on the page.'))));
      return;
    }
    if (!shown.length) { box.append(h('p', { class: 'muted' }, 'Nothing matches.')); return; }
    shown.forEach((r) => {
      const probs = Refs.problems(r);
      const used = h('span', { class: 'small muted', 'data-used': r.id }, usage ? usageText(usage[r.id]) : '');
      box.append(h('div', { class: 'card ref-row' },
        h('div', { class: 'ref-main' }, h('div', { class: 'ref-text', html: Refs.reference(r, '') }),
          h('div', { class: 'ref-meta' }, h('button', { type: 'button', class: 'idchip', title: 'Copy the citation marker', onclick: () => copyText('[@' + r.id + ']') }, '[@' + r.id + ']'), used,
            probs.length ? h('span', { class: 'small', style: { color: 'var(--warn)' } }, 'Check: ' + probs.join(', ')) : null)),
        h('div', { class: 'ref-actions' },
          h('button', { type: 'button', class: 'btn secondary small', onclick: () => openReferenceForm(r, reload, list) }, 'Edit'),
          h('button', { type: 'button', class: 'btn danger small', onclick: async () => {
            const n = usage && usage[r.id] ? usage[r.id].length : 0;
            if (await confirmDialog('Delete this reference?', n ? 'It is cited in ' + n + ' piece' + (n === 1 ? '' : 's') + ' (' + usage[r.id].join(', ') + '). Those citations will show as missing until you add it again.' : 'It is not cited anywhere.', 'Delete it', true)) {
              await busy(null, async () => { await saveRefs(list.filter((x) => x.id !== r.id)); toast('Deleted'); await reload(); });
            }
          } }, 'Delete'))));
    });
  }
  const plainText = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  const usageText = (u) => (u && u.length ? 'Cited in ' + u.length + ' piece' + (u.length === 1 ? '' : 's') : 'Not cited yet');
  search.addEventListener('input', draw);
  view.append(h('div', { class: 'row', style: { marginBottom: '1rem', gap: '.7rem', flexWrap: 'wrap' } },
    h('button', { type: 'button', class: 'btn', onclick: () => openImport(reload) }, icon('plus'), 'Add references'),
    h('button', { type: 'button', class: 'btn secondary', onclick: () => openReferenceForm(null, reload, list) }, 'Add by hand'),
    h('span', { class: 'spacer', style: { flex: 1 } }), search),
  h('p', { class: 'small muted', style: { marginBottom: '1rem' } }, list.length + ' reference' + (list.length === 1 ? '' : 's') + '. Style: APA 7th edition.'), box);
  draw();
  refUsage().then((u) => { usage = u; $$('[data-used]', box).forEach((el) => { el.textContent = usageText(u[el.dataset.used]); }); });
}

/* ── the Cite picker used by the editor ── */
function openCitePicker(refs, onInsert, onAdd) {
  const search = h('input', { type: 'text', placeholder: 'Search your references…' });
  const list = h('div', { class: 'cite-pick' });
  const mode = h('select', {}, h('option', { value: 'p' }, '(Author, Year)'), h('option', { value: 'n' }, 'Author (Year) in the sentence'), h('option', { value: 'y' }, '(Year) only: author already named'));
  const chosen = new Map();
  const plainText = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  function draw() {
    clear(list);
    const term = plainText(search.value);
    const items = Refs.sortRefs(refs).filter((r) => !term || plainText([Refs.authors(r).map((a) => a.family || a.org).join(' '), r.title, r.year, r.id].join(' ')).includes(term));
    if (!refs.length) { list.append(h('p', { class: 'muted' }, 'You have no references yet. Add some first.')); return; }
    items.forEach((r) => {
      const on = chosen.has(r.id);
      const loc = h('input', { type: 'text', class: 'loc', placeholder: 'page or section, e.g. p. 4', hidden: !on, value: chosen.get(r.id) || '', oninput: () => chosen.set(r.id, loc.value), onclick: (e) => e.stopPropagation() });
      const cb = h('input', { type: 'checkbox', checked: on, onchange: () => { if (cb.checked) chosen.set(r.id, ''); else chosen.delete(r.id); loc.hidden = !cb.checked; if (cb.checked) loc.focus(); } });
      list.append(h('label', { class: 'pick-item' }, cb, h('div', {}, h('div', { class: 'pick-name' }, Refs.shortRef(r)), h('div', { class: 'small muted' }, r.title || ''), loc)));
    });
  }
  search.addEventListener('input', draw); draw();
  const m = openModal({ title: 'Cite', wide: true,
    body: h('div', { class: 'stack' }, h('div', { class: 'row', style: { gap: '.6rem' } }, search, mode), list,
      onAdd ? h('div', {}, h('button', { type: 'button', class: 'btn quiet small', onclick: () => { m.close(); onAdd(); } }, icon('plus'), 'A source that is not in the list')) : null),
    actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Insert citation', onclick: () => {
      if (!chosen.size) { toast('Tick at least one source.', 'bad'); return false; }
      const parts = Array.from(chosen.entries()).map(([id, l]) => '@' + id + (l.trim() ? ', ' + l.trim() : ''));
      let marker;
      if (mode.value === 'n') marker = '[!' + parts.join('; ') + ']';
      else if (mode.value === 'y') marker = '[-' + parts[0] + (parts.length > 1 ? '; ' + parts.slice(1).join('; ') : '') + ']';
      else marker = '[' + parts.join('; ') + ']';
      onInsert(marker);
    } }] });
}
