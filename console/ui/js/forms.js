'use strict';
/* A form builder that edits plain data in place. Give it data and a list of field
   descriptions and it draws the inputs. Whenever anything changes it calls onChange. */

function fieldBox(f, control, extra) {
  const id = 'f' + Math.random().toString(36).slice(2, 8);
  if (control.setAttribute && (control.tagName === 'INPUT' || control.tagName === 'TEXTAREA' || control.tagName === 'SELECT')) control.id = id;
  return h('div', { class: 'field' + (f.wide ? ' wide' : '') },
    f.label ? h('label', { for: id }, f.label, f.required ? h('span', { class: 'muted' }, ' (required)') : null) : null,
    control,
    extra || null,
    f.hint ? h('div', { class: 'hint' }, f.hint) : null);
}

function counterFor(f, input) {
  if (!f.counter && !f.words) return null;
  const el = h('div', { class: 'counter' });
  const upd = () => {
    const v = input.value || '';
    if (f.words) { el.textContent = wordCount(v) + ' words' + (f.words.target ? ' (aim for about ' + f.words.target + ')' : ''); return; }
    const n = v.length; const [lo, hi] = f.counter;
    el.textContent = n + ' characters' + (n ? '' : '');
    el.className = 'counter ' + (n === 0 ? '' : n < lo ? 'long' : n <= hi ? 'good' : 'bad');
  };
  input.addEventListener('input', upd); upd();
  return el;
}

function renderField(obj, f, onChange, ctx) {
  const set = (v) => {
    if (v === '' || v == null) { if (!f.keepEmpty) delete obj[f.k]; else obj[f.k] = ''; }
    else obj[f.k] = v;
    onChange(f.k);
  };
  const cur = obj[f.k];
  switch (f.w || 'text') {
    case 'area': {
      const ta = h('textarea', { rows: f.rows || 3, value: cur == null ? '' : String(cur), oninput: () => set(ta.value) });
      return fieldBox(f, ta, counterFor(f, ta));
    }
    case 'number': {
      const inp = h('input', { type: 'number', value: cur == null ? '' : cur, oninput: () => set(inp.value === '' ? '' : Number(inp.value)) });
      return fieldBox(f, inp);
    }
    case 'date': {
      const inp = h('input', { type: 'date', value: cur == null ? '' : String(cur), oninput: () => set(inp.value) });
      return fieldBox(f, inp);
    }
    case 'select': {
      const sel = h('select', { onchange: () => set(sel.value) },
        (f.required ? [] : [h('option', { value: '' }, '(none)')]).concat(f.options.map((o) => {
          const val = typeof o === 'string' ? o : o.value; const lab = typeof o === 'string' ? o : o.label;
          return h('option', { value: val, selected: String(cur) === val }, lab);
        })));
      return fieldBox(f, sel);
    }
    case 'bool': {
      const cb = h('input', { type: 'checkbox', checked: !!cur, onchange: () => { obj[f.k] = cb.checked; onChange(f.k); } });
      return h('div', { class: 'field' + (f.wide ? ' wide' : '') }, h('label', { class: 'toggle' }, cb, f.label), f.hint ? h('div', { class: 'hint' }, f.hint) : null);
    }
    case 'cards': {
      const cards = h('div', { class: 'mode-cards', role: 'radiogroup', 'aria-label': f.label });
      const paint = () => { Array.from(cards.children).forEach((c) => { const on = c.dataset.v === String(obj[f.k] || f.options[0].value); c.setAttribute('aria-checked', String(on)); c.classList.toggle('on', on); }); };
      f.options.forEach((o) => cards.append(h('button', { type: 'button', role: 'radio', class: 'mode-card', 'data-v': o.value, onclick: () => { obj[f.k] = o.value; onChange(f.k); paint(); } },
        h('b', {}, o.label), h('span', {}, o.text))));
      paint();
      return h('div', { class: 'field wide' }, f.label ? h('div', { class: 'lbl' }, f.label) : null, cards, f.hint ? h('div', { class: 'hint' }, f.hint) : null);
    }
    case 'strlist': return renderStrList(obj, f, onChange);
    case 'objlist': return renderObjList(obj, f, onChange, ctx);
    case 'group': {
      if (!obj[f.k] || typeof obj[f.k] !== 'object') obj[f.k] = {};
      const sub = obj[f.k];
      const inner = renderFields(sub, f.fields, (k) => { if (!Object.keys(sub).length) delete obj[f.k]; onChange(f.k); }, ctx);
      if (f.collapsed) return h('details', { class: 'field wide group-details' }, h('summary', { class: 'subhead' }, f.label), inner);
      return h('div', { class: 'field wide' }, h('div', { class: 'subhead' }, f.label), inner);
    }
    case 'note': return h('div', { class: 'banner wide', style: { gridColumn: '1 / -1' } }, f.text);
    case 'preview': {
      const line = h('div', { class: 'preview-line' });
      const upd = () => { line.textContent = f.fn(obj); };
      upd(); ctx.previews.push(upd);
      return h('div', { class: 'field wide' }, h('div', { class: 'lbl' }, f.label || 'Preview'), line);
    }
    default: {
      const inp = h('input', { type: f.type || 'text', value: cur == null ? '' : String(cur), placeholder: f.placeholder || '', oninput: () => { set(inp.value); if (f.validate) showErr(); } });
      const errEl = h('div', { class: 'err', hidden: true });
      const showErr = () => { const m = f.validate ? f.validate(inp.value, obj, ctx) : ''; errEl.textContent = m || ''; errEl.hidden = !m; };
      if (f.validate) setTimeout(showErr, 0);
      return fieldBox(f, inp, [counterFor(f, inp), errEl]);
    }
  }
}

function renderFields(obj, fields, onChange, ctx) {
  ctx = ctx || { previews: [] };
  const wrap = h('div', { class: 'fields' });
  const rebuild = () => {
    clear(wrap);
    for (const f of fields) {
      if (f.showIf && !f.showIf(obj)) continue;
      wrap.append(renderField(obj, f, (k) => { ctx.previews.forEach((p) => p()); onChange(k); }, ctx));
    }
  };
  rebuild();
  return wrap;
}

function renderStrList(obj, f, onChange) {
  if (!Array.isArray(obj[f.k])) obj[f.k] = [];
  const box = h('div', { class: 'field wide' });
  const list = h('div');
  const draw = () => {
    clear(list);
    const arr = obj[f.k];
    arr.forEach((val, i) => {
      const inp = f.area
        ? h('textarea', { rows: f.rows || 2, value: val, oninput: () => { arr[i] = inp.value; onChange(f.k); } })
        : h('input', { type: 'text', value: val, placeholder: f.placeholder || '', oninput: () => { arr[i] = inp.value; onChange(f.k); } });
      list.append(h('div', { class: 'strrow' }, inp,
        h('button', { type: 'button', class: 'btn quiet icon', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); onChange(f.k); draw(); } }, icon('up')),
        h('button', { type: 'button', class: 'btn quiet icon', title: 'Move down', 'aria-label': 'Move down', disabled: i === arr.length - 1, onclick: () => { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); onChange(f.k); draw(); } }, icon('down')),
        h('button', { type: 'button', class: 'btn quiet icon', title: 'Remove', 'aria-label': 'Remove', onclick: () => { arr.splice(i, 1); onChange(f.k); draw(); } }, icon('trash'))));
    });
  };
  draw();
  box.append(h('div', { class: 'subhead' }, f.label,
    h('button', { type: 'button', class: 'btn secondary small', onclick: () => { obj[f.k].push(''); onChange(f.k); draw(); const last = list.querySelector('.strrow:last-child input, .strrow:last-child textarea'); if (last) last.focus(); } }, icon('plus'), f.addLabel || 'Add')),
    list, f.hint ? h('div', { class: 'hint' }, f.hint) : null);
  return box;
}

function renderObjList(obj, f, onChange, ctx) {
  if (!Array.isArray(obj[f.k])) obj[f.k] = [];
  const arr = obj[f.k];
  const open = new WeakSet();
  const box = h('div', { class: 'field wide' });
  const list = h('div');
  const draw = () => {
    clear(list);
    arr.forEach((item, i) => {
      const titleEl = h('span', { class: 'item-title' });
      const setTitle = () => {
        const t = f.itemLabel ? f.itemLabel(item, i) : (item.title || 'Item ' + (i + 1));
        clear(titleEl); titleEl.append(t.main || t, t.sub ? h('small', {}, t.sub) : '');
      };
      setTitle();
      const move = (d) => (e) => { e.preventDefault(); e.stopPropagation(); const j = i + d; if (j < 0 || j >= arr.length) return; arr.splice(j, 0, arr.splice(i, 1)[0]); onChange(f.k); draw(); };
      const details = h('details', { class: 'item', open: open.has(item) },
        h('summary', {}, titleEl,
          h('span', { class: 'item-actions' },
            h('button', { type: 'button', class: 'btn quiet icon', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: move(-1) }, icon('up')),
            h('button', { type: 'button', class: 'btn quiet icon', title: 'Move down', 'aria-label': 'Move down', disabled: i === arr.length - 1, onclick: move(1) }, icon('down')),
            h('button', { type: 'button', class: 'btn quiet icon', title: 'Delete', 'aria-label': 'Delete', onclick: async (e) => {
              e.preventDefault(); e.stopPropagation();
              if (await confirmDialog('Delete this?', (f.itemLabel ? (f.itemLabel(item, i).main || f.itemLabel(item, i)) : 'This item') + ' will be removed when you save.', 'Delete', true)) { arr.splice(i, 1); onChange(f.k); draw(); }
            } }, icon('trash')))),
        h('div', { class: 'item-body' }, renderFields(item, f.fields, () => { setTitle(); onChange(f.k); }, ctx)));
      details.addEventListener('toggle', () => { if (details.open) open.add(item); else open.delete(item); });
      list.append(details);
    });
    if (!arr.length) list.append(h('div', { class: 'empty' }, f.empty || 'Nothing here yet.'));
  };
  draw();
  box.append(h('div', { class: 'subhead' }, f.label,
    h('button', { type: 'button', class: 'btn secondary small', onclick: () => {
      const it = f.newItem ? f.newItem() : {};
      if (f.addFirst) arr.unshift(it); else arr.push(it);
      open.add(it); onChange(f.k); draw();
      const target = f.addFirst ? list.firstElementChild : list.lastElementChild;
      if (target) { const inp = target.querySelector('input, textarea'); target.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (inp) inp.focus(); }
    } }, icon('plus'), f.addLabel || 'Add')),
    f.hint ? h('div', { class: 'hint', style: { marginBottom: '.5rem' } }, f.hint) : null,
    list);
  return box;
}

/* Remove empty values before saving, so the files stay tidy. */
function pruneEmpty(v) {
  if (Array.isArray(v)) return v.map(pruneEmpty);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const p = pruneEmpty(x);
      const empty = p == null || p === '' || (Array.isArray(p) && p.length === 0) || (typeof p === 'object' && !Array.isArray(p) && Object.keys(p).length === 0);
      if (!empty) out[k] = p;
    }
    return out;
  }
  return v;
}

/* A whole page for editing one data file, with a save bar. */
async function dataPage(view, { name, intro, fields, root = 'object', validate, afterSave, headerExtra }) {
  const res = await GET('/api/data?name=' + name);
  let data = res.data;
  if (data == null) data = root === 'array' ? [] : {};
  let working = JSON.parse(JSON.stringify(data));
  let original = JSON.stringify(pruneEmpty(data));
  const holder = root === 'array' ? { items: working } : working;
  const flds = root === 'array' ? [fields] : fields;
  const msg = h('span', { class: 'msg' }, 'No changes yet');
  const saveBtn = h('button', { type: 'button', class: 'btn', disabled: true }, 'Save changes');
  const discard = h('button', { type: 'button', class: 'btn secondary', disabled: true, onclick: () => { setDirty(false); render(); } }, 'Discard changes');
  const update = () => {
    const now = JSON.stringify(pruneEmpty(root === 'array' ? holder.items : holder));
    const changed = now !== original;
    setDirty(changed);
    const problems = validate ? validate(root === 'array' ? holder.items : holder) : [];
    msg.className = 'msg' + (problems.length ? ' errors' : changed ? ' dirty' : '');
    msg.textContent = problems.length ? problems[0] : changed ? 'You have unsaved changes' : 'All changes saved';
    saveBtn.disabled = !changed || problems.length > 0;
    discard.disabled = !changed;
  };
  saveBtn.onclick = () => busy(saveBtn, async () => {
    await PUT('/api/data?name=' + name, { data: pruneEmpty(root === 'array' ? holder.items : holder) });
    toast('Saved', 'ok');
    setDirty(false);
    if (afterSave) await afterSave();
    await refreshInfo();
    render();
  }, 'Saving…');
  if (intro) view.append(h('p', { class: 'muted', style: { maxWidth: '48rem', marginBottom: '1rem' } }, intro));
  if (headerExtra) view.append(headerExtra);
  view.append(h('div', { class: 'card' }, renderFields(holder, flds, update)));
  view.append(h('div', { class: 'savebar' }, msg, discard, saveBtn));
  update();
}
