'use strict';
/* Series and themes: the lists, the editors, and the "Series and themes" card inside a piece of writing.
   A series is an ordered run of pieces (Part 1, Part 2, ...). A theme is a subject that pieces share.
   Everything here only edits ordinary files, so nothing is hidden from you. */

KIND_INFO.series = { noun: 'series', plural: 'Series', route: 'series', blurb: 'A run of essays that build on each other. Readers see "Part 2 of 5", and next and previous links.' };
KIND_INFO.themes = { noun: 'theme', plural: 'Themes', route: 'themes', blurb: 'The subjects you keep coming back to. A piece can have several. Readers can follow a theme to find more.' };

/* ── shared helpers ── */
async function loadHubs() {
  const get = async (k) => (await GET('/api/list?kind=' + k)).items;
  const [series, themes, writing] = await Promise.all([get('series'), get('themes'), get('writing')]);
  return { series, themes, writing };
}
const hubLive = (it) => !it.error && it.front.published !== false;
const hubPart = (it) => { const n = parseInt(it.front.series_part, 10); return n > 0 ? n : 0; };
function seriesPieces(hubs, slug, liveOnly) {
  return hubs.writing.filter((w) => !w.error && String(w.front.series || '') === slug && (!liveOnly || hubLive(w)))
    .sort((a, b) => (hubPart(a) || 999) - (hubPart(b) || 999) || String(a.front.date || '').localeCompare(String(b.front.date || '')));
}
function themePieces(hubs, slug, liveOnly) {
  return hubs.writing.filter((w) => !w.error && Array.isArray(w.front.themes) && w.front.themes.map(String).includes(slug) && (!liveOnly || hubLive(w)))
    .sort((a, b) => String(b.front.date || '').localeCompare(String(a.front.date || '')));
}
function nextFreePart(hubs, slug, exceptPath) {
  const used = new Set(seriesPieces(hubs, slug).filter((w) => w.path !== exceptPath).map(hubPart));
  let n = 1; while (used.has(n)) n += 1;
  return n;
}
const plannedOf = (sr) => (Array.isArray(sr && sr.front && sr.front.planned) ? sr.front.planned : []).filter((x) => x && parseInt(x.part, 10) > 0);
const hubPath = (kind, slug) => (kind === 'series' ? '_series/' : '_themes/') + slug + '.md';
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

function seriesState(hubs, sr) {
  const live = seriesPieces(hubs, sr.slug, true).length;
  if (!live) return { cls: 'warn', label: 'Hidden', why: 'It shows on the site once its first piece is published.' };
  return { cls: 'ok', label: 'Live', why: '' };
}
function themeState(hubs, t) {
  const n = themePieces(hubs, t.slug, true).length;
  if (n >= 2) return { cls: 'ok', label: 'Live', why: '', n };
  return { cls: 'warn', label: 'Hidden', why: n === 0 ? 'No published piece uses it yet.' : 'It shows on the site once a second piece uses it.', n };
}

/* Make a new series or theme without leaving what you are doing. Calls done(item) afterwards. */
function quickCreateHub(kind, done) {
  const noun = KIND_INFO[kind].noun;
  const title = h('input', { type: 'text', placeholder: kind === 'series' ? 'Title of the series' : 'Name of the theme, for example Faith and work' });
  openModal({
    title: 'New ' + noun,
    body: h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', {}, 'Title'), title,
        h('div', { class: 'hint' }, kind === 'series' ? 'You can set the short name, the summary and the planned parts afterwards, on the series page.' : 'You can add a one-line summary afterwards, on the theme page.'))),
    actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Create', close: false, onclick: async (btn, close) => {
      const t = title.value.trim();
      if (!t) { toast('Please give it a title.', 'bad'); return false; }
      const slug = slugify(t).split('-').slice(0, 6).join('-');
      try {
        const r = await POST('/api/doc/create', { kind, title: t, slug });
        close();
        await refreshInfo();
        done({ slug: r.path.split('/').pop().replace(/\.[^.]+$/, ''), title: t, path: r.path, front: { title: t } });
      } catch (e) { fail(e); }
      return false;
    } }]
  });
  setTimeout(() => title.focus(), 50);
}

/* ── The card inside a piece of writing ── */
async function buildSeriesThemesCard(ctx) {
  let hubs = { series: [], themes: [], writing: [] };
  try { hubs = await loadHubs(); } catch (e) { /* the card then simply shows empty lists */ }
  const root = h('div', { class: 'card' });
  const A = {
    series: { k: 'series', kind: 'str' },
    part: { k: 'series_part', kind: 'num' },
    themes: { k: 'themes', kind: 'list' }
  };
  const draw = () => {
    clear(root);
    const curSeries = String(ctx.parsed.series || '');
    const curPart = ctx.parsed.series_part == null ? '' : ctx.parsed.series_part;
    const curThemes = Array.isArray(ctx.parsed.themes) ? ctx.parsed.themes.map(String) : [];
    const sr = hubs.series.find((x) => x.slug === curSeries);

    /* series */
    const sel = h('select', { 'aria-label': 'Series' });
    sel.append(h('option', { value: '' }, 'Not part of a series'));
    hubs.series.forEach((x) => sel.append(h('option', { value: x.slug, selected: x.slug === curSeries }, x.front.short_title || x.title)));
    if (curSeries && !sr) sel.append(h('option', { value: curSeries, selected: true }, curSeries + ' (does not exist)'));
    sel.append(h('option', { value: '__new' }, '＋ Start a new series…'));
    sel.value = curSeries;
    sel.addEventListener('change', () => {
      if (sel.value === '__new') {
        sel.value = curSeries;
        quickCreateHub('series', async (it) => {
          hubs = await loadHubs();
          ctx.apply(A.series, it.slug); ctx.apply(A.part, nextFreePart(hubs, it.slug, ctx.path));
          draw();
        });
        return;
      }
      if (sel.value) { ctx.apply(A.series, sel.value); ctx.apply(A.part, nextFreePart(hubs, sel.value, ctx.path)); }
      else { ctx.apply(A.series, ''); ctx.apply(A.part, ''); }
      draw();
    });

    const note = h('div', { class: 'hint' });
    const partIn = h('input', { type: 'number', min: '1', step: '1', value: curPart === '' ? '' : String(curPart), style: { maxWidth: '7rem' }, 'aria-label': 'Part number' });
    const updNote = () => {
      clear(note); note.className = 'hint';
      const s = hubs.series.find((x) => x.slug === String(ctx.parsed.series || ''));
      if (!s) return;
      const p = parseInt(ctx.parsed.series_part, 10) || 0;
      const others = seriesPieces(hubs, s.slug).filter((w) => w.path !== ctx.path);
      const twin = p ? others.find((w) => hubPart(w) === p) : null;
      const total = parseInt(s.front.total_parts, 10) || 0;
      const plan = p ? plannedOf(s).find((x) => parseInt(x.part, 10) === p) : null;
      if (!p) { note.textContent = 'Give it a part number so the series can put it in order.'; note.classList.add('err'); return; }
      if (twin) { note.textContent = 'Part ' + p + ' is already used by “' + twin.title + '”. Pick another number.'; note.classList.add('err'); return; }
      const bits = [total ? 'Part ' + p + ' of ' + total : 'Part ' + p];
      if (total && p > total) { bits.length = 0; bits.push('Part ' + p + ' is past the ' + total + ' parts the series says it has. Raise the number of parts on the series page.'); note.classList.add('err'); }
      else if (plan) bits.push('planned as “' + plan.title + '”');
      note.textContent = bits.join(' · ');
    };
    partIn.addEventListener('input', () => { ctx.apply(A.part, partIn.value === '' ? '' : Math.max(1, Math.round(Number(partIn.value)))); updNote(); });
    const nextBtn = h('button', { type: 'button', class: 'btn quiet small', onclick: () => { const n = nextFreePart(hubs, curSeries, ctx.path); ctx.apply(A.part, n); partIn.value = String(n); updNote(); } }, 'Use the next free number');

    const seriesBox = h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Series'), sel),
      curSeries ? h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Part number'),
        h('div', { class: 'row', style: { gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' } }, partIn, nextBtn,
          sr ? h('a', { class: 'btn quiet small', href: '#/series/edit/' + q(sr.path) }, 'Open the series') : null), note) : null);
    updNote();

    /* themes */
    const themeBox = h('div', { class: 'theme-picks' });
    hubs.themes.slice().sort((a, b) => (a.front.order || 0) - (b.front.order || 0)).forEach((t) => {
      const on = curThemes.includes(t.slug);
      const others = themePieces(hubs, t.slug, true).filter((w) => w.path !== ctx.path).length;
      const cb = h('input', { type: 'checkbox', checked: on, onchange: () => {
        const now = new Set(Array.isArray(ctx.parsed.themes) ? ctx.parsed.themes.map(String) : []);
        cb.checked ? now.add(t.slug) : now.delete(t.slug);
        const ordered = hubs.themes.map((x) => x.slug).filter((s) => now.has(s)).concat([...now].filter((s) => !hubs.themes.some((x) => x.slug === s)));
        ctx.apply(A.themes, ordered.length ? ordered : '');
        draw();
      } });
      themeBox.append(h('label', { class: 'theme-pick' + (on ? ' on' : '') }, cb, h('span', {}, t.title, h('small', { class: 'muted' }, others ? ' · ' + plural(others, 'other piece', 'other pieces') : ''))));
    });
    curThemes.filter((s) => !hubs.themes.some((x) => x.slug === s)).forEach((s) => {
      const cb = h('input', { type: 'checkbox', checked: true, onchange: () => { ctx.apply(A.themes, curThemes.filter((x) => x !== s).length ? curThemes.filter((x) => x !== s) : ''); draw(); } });
      themeBox.append(h('label', { class: 'theme-pick on bad' }, cb, h('span', {}, s, h('small', {}, ' · does not exist, untick to remove'))));
    });
    const addTheme = h('button', { type: 'button', class: 'btn quiet small', onclick: () => quickCreateHub('themes', async (it) => {
      hubs = await loadHubs();
      const now = (Array.isArray(ctx.parsed.themes) ? ctx.parsed.themes.map(String) : []).concat([it.slug]);
      ctx.apply(A.themes, now); draw();
    }) }, icon('plus'), 'New theme');
    const live = curThemes.filter((s) => hubs.themes.some((x) => x.slug === s)).length;
    const themeTip = !hubs.themes.length ? 'You have no themes yet. Make one, for example “Faith and work”, and tick it here.'
      : !live ? 'Tick the subjects this piece is about. Two or three is plenty.' : 'A theme page shows on the site once two published pieces share it.';

    root.append(h('h2', {}, 'Series and themes'),
      h('p', { class: 'sub' }, 'Where this piece sits among your other writing. Readers get a part banner, next and previous links, and “keep reading” suggestions from these.'),
      seriesBox,
      h('div', { class: 'field', style: { marginTop: '1.1rem' } }, h('div', { class: 'lbl' }, 'Themes'), themeBox,
        h('div', { class: 'row', style: { gap: '.6rem', alignItems: 'center', marginTop: '.4rem' } }, addTheme), h('div', { class: 'hint' }, themeTip)));
  };
  draw();
  return { el: root, redraw: draw };
}

/* ── Lists ── */
async function viewHubList(view, kind) {
  const k = KIND_INFO[kind];
  setTitle(k.plural, k.blurb, topActions());
  const hubs = await loadHubs();
  const items = hubs[kind].slice();
  if (kind === 'themes') items.sort((a, b) => (a.front.order || 0) - (b.front.order || 0));
  else items.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  view.append(h('div', { class: 'row between', style: { marginBottom: '1rem' } },
    h('span', { class: 'muted' }, plural(items.length, k.noun, k.plural.toLowerCase())),
    h('button', { type: 'button', class: 'btn', onclick: () => newDocDialog(kind) }, icon('plus'), 'New ' + k.noun)));
  if (!items.length) {
    view.append(h('div', { class: 'empty' }, kind === 'series' ? 'No series yet. Press "New series" to start one. It stays hidden from visitors until its first piece is published.' : 'No themes yet. Press "New theme" and name a subject you write about.'));
    return;
  }
  view.append(h('div', { class: 'card', style: { padding: 0 } }, h('table', { class: 't' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Title'), h('th', {}, kind === 'series' ? 'Pieces' : 'Pieces'), h('th', {}, 'On the site'), h('th', {}, ''))),
    h('tbody', {}, items.map((it) => {
      const fm = it.front;
      let count; let st;
      if (kind === 'series') {
        const all = seriesPieces(hubs, it.slug); const live = all.filter(hubLive).length;
        const total = parseInt(fm.total_parts, 10) || (fm.status === 'complete' ? live : 0);
        count = live + (total ? ' of ' + total : '') + (all.length > live ? ' (+' + (all.length - live) + ' draft' + (all.length - live > 1 ? 's' : '') + ')' : '');
        st = seriesState(hubs, it);
      } else {
        const all = themePieces(hubs, it.slug); const live = all.filter(hubLive).length;
        count = String(live) + (all.length > live ? ' (+' + (all.length - live) + ' draft' + (all.length - live > 1 ? 's' : '') + ')' : '');
        st = themeState(hubs, it);
      }
      return h('tr', {},
        h('td', {}, h('a', { class: 't-title', href: '#/' + k.route + '/edit/' + q(it.path), style: { textDecoration: 'none' } }, kind === 'series' ? (fm.short_title || it.title) : it.title),
          it.error ? h('div', { class: 'err small' }, it.error) : h('div', { class: 'small muted' }, kind === 'series' && fm.short_title && fm.short_title !== it.title ? it.title : (fm.summary ? String(fm.summary) : it.url))),
        h('td', { class: 'muted' }, count),
        h('td', {}, h('span', { class: 'chip ' + st.cls }, st.label), st.why ? h('div', { class: 'small muted', style: { marginTop: '.25rem' } }, st.why) : null),
        h('td', {}, h('div', { class: 't-actions' }, st.label === 'Live' ? h('a', { class: 'btn quiet small', href: viewUrl(it.url || '/'), target: '_blank', rel: 'noopener' }, 'View') : null,
          h('a', { class: 'btn secondary small', href: '#/' + k.route + '/edit/' + q(it.path) }, 'Edit'))));
    })))));
}

/* ── The editor for one series or theme ── */
async function viewHubEdit(view, kind, path) {
  const k = KIND_INFO[kind];
  const doc = await GET('/api/doc?path=' + q(path));
  let hubs = await loadHubs();
  const slug = path.split('/').pop().replace(/\.[^.]+$/, '');
  let fm = doc.front_raw; let body = doc.body; const parsed = doc.front; let mtime = doc.mtime;
  const orig = { fm, body };
  let yamlOk = true;
  setTitle((kind === 'series' && parsed.short_title) || parsed.title || path, k.plural + ' · ' + path, topActions());

  const msg = h('div', { class: 'small muted' }, 'All changes saved');
  const saveBtn = h('button', { type: 'button', class: 'btn', disabled: true }, 'Save');
  const yamlArea = h('textarea', { class: 'yaml-area', spellcheck: 'false', rows: 14, value: fm });
  const yamlErr = h('div', { class: 'err' });
  const bodyArea = h('textarea', { spellcheck: 'true', value: body, rows: kind === 'series' ? 9 : 6 });
  let plannedDraw = null; let planModel = [];

  function markDirty() {
    const changed = fm !== orig.fm || bodyArea.value !== orig.body;
    setDirty(changed && yamlOk);
    msg.textContent = !yamlOk ? 'The front matter has a mistake (see below)' : changed ? 'You have unsaved changes' : 'All changes saved';
    msg.className = 'small ' + (!yamlOk ? 'err' : changed ? '' : 'muted');
    saveBtn.disabled = !changed || !yamlOk;
  }
  function apply(def, val) {
    fm = setField(fm, def.k, def.kind, val); yamlArea.value = fm;
    if (val === '' || val == null) delete parsed[def.k]; else parsed[def.k] = val;
    markDirty();
  }
  bodyArea.addEventListener('input', () => { body = bodyArea.value; markDirty(); });

  const titleInput = h('input', { type: 'text', class: 'title-input', value: parsed.title || '', placeholder: 'Title', 'aria-label': 'Title' });
  titleInput.addEventListener('input', () => apply({ k: 'title', kind: 'str' }, titleInput.value));

  const inputs = [];
  const textField = (label, key, opts = {}) => {
    const cur = parsed[key];
    const ctl = opts.area ? h('textarea', { rows: 3, value: cur || '', oninput: () => apply({ k: key, kind: 'folded' }, ctl.value.replace(/\s*\n\s*/g, ' ')) })
      : h('input', { type: opts.num ? 'number' : 'text', value: cur == null ? '' : String(cur), placeholder: opts.placeholder || '',
        oninput: () => apply({ k: key, kind: opts.num ? 'num' : 'str' }, opts.num ? (ctl.value === '' ? '' : Number(ctl.value)) : ctl.value) });
    inputs.push({ key, el: ctl, num: opts.num });
    return h('div', { class: 'field' + (opts.wide ? ' wide' : '') }, h('div', { class: 'lbl' }, label), ctl, opts.hint ? h('div', { class: 'hint' }, opts.hint) : null);
  };

  /* what is in it, shown beside the editor */
  const listCard = h('div', { class: 'card' });
  const drawList = () => {
    clear(listCard);
    const pieces = kind === 'series' ? seriesPieces(hubs, slug) : themePieces(hubs, slug);
    listCard.append(h('div', { class: 'card-title' }, kind === 'series' ? 'Pieces in this series' : 'Pieces with this theme'));
    if (!pieces.length) { listCard.append(h('p', { class: 'muted small' }, kind === 'series' ? 'None yet. Choose this series in a piece’s “Series and themes” card, or press “Write a part” below.' : 'None yet. Tick this theme in a piece’s “Series and themes” card.')); return; }
    listCard.append(h('div', { class: 'stack', style: { gap: '.5rem' } }, pieces.map((w) =>
      h('div', { class: 'row', style: { gap: '.5rem', alignItems: 'baseline' } },
        kind === 'series' ? h('span', { class: 'chip plain ' + (hubPart(w) ? 'info' : 'bad') }, hubPart(w) ? String(hubPart(w)) : '?') : null,
        h('a', { href: '#/writing/edit/' + q(w.path), style: { flex: 1 } }, w.title),
        h('span', { class: 'chip ' + (hubLive(w) ? 'ok' : 'warn') }, hubLive(w) ? 'Published' : 'Draft')))));
  };
  drawList();

  /* series: planned parts */
  let planCard = null;
  const writePart = () => newDocDialog('writing', { series: slug });
  if (kind === 'series') {
    const readPlan = () => plannedOf({ front: parsed }).map((x) => ({ part: parseInt(x.part, 10), title: String(x.title || ''), note: String(x.note || '') }));
    planModel = readPlan();
    const list = h('div', { class: 'stack' });
    const commit = () => {
      fm = setPlanned(fm, planModel); yamlArea.value = fm;
      const clean = planModel.filter((x) => x.title.trim() && x.part > 0).map((x) => ({ part: x.part, title: x.title.trim(), note: x.note.trim() }));
      parsed.planned = clean; markDirty();
    };
    plannedDraw = (keep) => {
      if (!keep) planModel = readPlan();
      clear(list);
      const live = seriesPieces(hubs, slug, true);
      if (!planModel.length) list.append(h('p', { class: 'muted' }, 'Nothing planned. Add the parts you already know you will write. Readers see them as “Coming”, with the title only, until you publish the piece.'));
      planModel.forEach((x, i) => {
        const done = live.find((w) => hubPart(w) === x.part);
        const num = h('input', { type: 'number', min: '1', step: '1', value: String(x.part || ''), 'aria-label': 'Part number', oninput: () => { x.part = parseInt(num.value, 10) || 0; commit(); } });
        num.style.cssText = 'flex:0 0 4.5rem;width:4.5rem';
        const ti = h('input', { type: 'text', value: x.title, placeholder: 'Title of this part', 'aria-label': 'Title', oninput: () => { x.title = ti.value; commit(); } });
        ti.style.cssText = 'flex:1 1 14rem;width:auto;min-width:0';
        const no = h('input', { type: 'text', value: x.note, placeholder: 'A private note to yourself (optional)', 'aria-label': 'Note', oninput: () => { x.note = no.value; commit(); } });
        list.append(h('div', { style: { padding: '.7rem', border: '1px solid var(--line-2)', borderRadius: '10px' } },
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center' } }, h('span', { class: 'small muted' }, 'Part'), num, ti,
            done ? h('span', { class: 'chip ok' }, 'Published') : null,
            h('button', { type: 'button', class: 'btn quiet small', title: 'Remove', 'aria-label': 'Remove this planned part', onclick: async () => {
              if (await confirmDialog('Remove this planned part?', '“' + (x.title || 'Untitled') + '” will no longer show as coming. A published piece is not affected.', 'Remove it', true)) { planModel.splice(i, 1); commit(); plannedDraw(true); }
            } }, icon('trash'))),
          h('div', { style: { marginTop: '.5rem' } }, no)));
      });
    };
    plannedDraw(false);
    const addPlan = () => {
      const used = new Set(planModel.map((x) => x.part).concat(seriesPieces(hubs, slug).map(hubPart)));
      let n = 1; while (used.has(n)) n += 1;
      planModel.push({ part: n, title: '', note: '' });
      plannedDraw(true);
      const ins = list.querySelectorAll('input[type=text]'); if (ins.length) ins[ins.length - 2 >= 0 ? ins.length - 2 : 0].focus();
    };
    planCard = h('div', { class: 'card' }, h('h2', {}, 'Planned parts'),
      h('p', { class: 'sub' }, 'Parts you intend to write. They show on the series page as “Coming” (title only) and are replaced by the real piece when you publish a piece with that part number. The note is only for you and is never shown.'),
      list,
      h('div', { class: 'row', style: { marginTop: '.8rem', gap: '.6rem', flexWrap: 'wrap' } },
        h('button', { type: 'button', class: 'btn secondary', onclick: addPlan }, icon('plus'), 'Plan a part'),
        h('button', { type: 'button', class: 'btn quiet', onclick: writePart }, icon('pen'), 'Write a part now')));
  }

  /* fields */
  const fields = h('div', { class: 'fields' });
  if (kind === 'series') {
    const status = h('select', { 'aria-label': 'Status', onchange: () => apply({ k: 'status', kind: 'str' }, status.value) },
      [['ongoing', 'Ongoing'], ['complete', 'Complete']].map(([v, t]) => h('option', { value: v, selected: (parsed.status || 'ongoing') === v }, t)));
    fields.append(
      textField('Short title', 'short_title', { hint: 'Used in the part banner, for example “Part 2 of 3 · FOSS in Nigerian Engineering Education”.', wide: true }),
      textField('Summary', 'summary', { area: true, wide: true, hint: 'One or two sentences. Shown on the Writing page and in search results.' }),
      h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Status'), status, h('div', { class: 'hint' }, 'Ongoing: more parts are coming. Complete: every part is published, so readers see “Part 2 of 2”.')),
      textField('Total number of parts', 'total_parts', { num: true, hint: 'Leave empty if you do not know yet. Readers then see “Part 2” without “of …”.' }));
  } else {
    fields.append(
      textField('Summary', 'summary', { area: true, wide: true, hint: 'One sentence about what this theme covers. Shown on the themes page.' }),
      textField('Longer description (optional)', 'description', { area: true, wide: true, hint: 'For Google. About 150 characters. Falls back to the summary.' }),
      textField('Order on the themes page', 'order', { num: true, hint: 'Lowest number comes first.' }));
  }

  /* raw front matter */
  async function reparse() {
    try {
      const r = await POST('/api/yaml/parse', { text: fm });
      if (r.ok) {
        yamlOk = true; yamlErr.textContent = '';
        Object.keys(parsed).forEach((x) => delete parsed[x]); Object.assign(parsed, r.data || {});
        inputs.forEach(({ key, el }) => { if (document.activeElement !== el) el.value = parsed[key] == null ? '' : String(parsed[key]); });
        if (document.activeElement !== titleInput) titleInput.value = parsed.title || '';
        if (plannedDraw) plannedDraw(false);
      } else { yamlOk = false; yamlErr.textContent = r.error; }
    } catch (e) { yamlOk = false; yamlErr.textContent = e.message; }
    markDirty();
  }
  const reparseSoon = debounce(reparse, 350);
  yamlArea.addEventListener('input', () => { fm = yamlArea.value; markDirty(); reparseSoon(); });

  saveBtn.onclick = () => busy(saveBtn, async () => {
    const r = await PUT('/api/doc', { path, front_raw: fm, body: bodyArea.value, mtime, has_front: true });
    mtime = r.mtime; orig.fm = fm; orig.body = bodyArea.value; setDirty(false); markDirty();
    toast('Saved', 'ok'); await refreshInfo();
    hubs = await loadHubs(); drawList(); if (plannedDraw) plannedDraw(true);
  }, 'Saving…');
  const keyHandler = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!saveBtn.disabled) saveBtn.click(); } };
  document.addEventListener('keydown', keyHandler); onLeave(() => document.removeEventListener('keydown', keyHandler));

  /* deleting also tidies the pieces that pointed at it, so nothing is left dangling */
  const delBtn = h('button', { type: 'button', class: 'btn danger small', onclick: async () => {
    const users = kind === 'series' ? seriesPieces(hubs, slug) : themePieces(hubs, slug);
    const detail = users.length ? ' ' + plural(users.length, 'piece uses', 'pieces use') + ' it. They will be kept, and only this ' + k.noun + ' will be taken off them.' : '';
    if (!(await confirmDialog('Delete this ' + k.noun + '?', '“' + (parsed.title || slug) + '” will be removed.' + detail + ' A backup copy is kept on this computer.', 'Delete it', true))) return;
    await busy(null, async () => {
      for (const w of users) {
        const d = await GET('/api/doc?path=' + q(w.path));
        let f = d.front_raw;
        if (kind === 'series') { f = setField(f, 'series', 'str', ''); f = setField(f, 'series_part', 'num', ''); }
        else { const left = (Array.isArray(d.front.themes) ? d.front.themes.map(String) : []).filter((x) => x !== slug); f = setField(f, 'themes', 'list', left.length ? left : ''); }
        await PUT('/api/doc', { path: w.path, front_raw: f, body: d.body, mtime: d.mtime, has_front: true });
      }
      await POST('/api/doc/delete', { path });
      setDirty(false); toast('Deleted'); go('/' + k.route);
    });
  } }, icon('trash'), 'Delete');

  const st = kind === 'series' ? seriesState(hubs, { slug }) : themeState(hubs, { slug });
  const addr = (S.info ? S.info.site.url.replace('https://', '') : '') + (kind === 'series' ? '/writing/series/' : '/writing/themes/') + slug + '/';
  const sideCards = [
    h('div', { class: 'card' }, h('div', { class: 'row' }, saveBtn, st.label === 'Live' ? h('a', { class: 'btn secondary', href: viewUrl(doc.url || '/'), target: '_blank', rel: 'noopener' }, 'View page ', icon('ext')) : null),
      h('div', { style: { marginTop: '.7rem' } }, msg),
      h('div', { style: { marginTop: '.9rem' } }, h('span', { class: 'chip ' + st.cls }, st.label), h('div', { class: 'small muted', style: { marginTop: '.35rem' } }, st.why || 'Visitors can see this page.'), h('div', { class: 'small mono muted', style: { marginTop: '.35rem' } }, addr)),
      h('div', { style: { marginTop: '1rem' } }, delBtn)),
    listCard,
    kind === 'series' ? h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Add to this series'), h('p', { class: 'sub small' }, 'Starts a new draft with this series and the next free part number already set.'),
      h('button', { type: 'button', class: 'btn secondary', onclick: writePart }, icon('pen'), 'Write a part')) : null
  ].filter(Boolean);

  const bodyCard = h('div', { class: 'card' }, h('h2', {}, kind === 'series' ? 'Introduction' : 'About this theme (optional)'),
    h('p', { class: 'sub' }, kind === 'series' ? 'A few lines, in your own words, at the top of the series page: what the argument is and why to read in order. Plain Markdown.' : 'Optional. A paragraph shown above the list of pieces. Leave empty if the summary says it.'), bodyArea);
  const advanced = h('details', { class: 'card' }, h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Advanced: the top of the file (front matter)'),
    h('p', { class: 'sub', style: { marginTop: '.6rem' } }, 'The boxes above edit this same text. Only change it here if you know what you are doing.'), yamlArea, yamlErr);
  view.append(h('div', { class: 'editor' },
    h('div', { class: 'stack' }, h('div', { class: 'card' }, titleInput, h('div', { style: { marginTop: '1.2rem' } }, fields)), planCard, bodyCard, advanced),
    h('div', { class: 'editor-side' }, sideCards)));
  markDirty();
}
