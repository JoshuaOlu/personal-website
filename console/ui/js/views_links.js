'use strict';
/* Short links: addresses on your site that forward elsewhere. */

function linkState(fm) {
  const today = todayStr();
  const st = fm.status || 'live';
  const opens = fm.opens_on ? String(fm.opens_on) : ''; const ends = fm.ends_on ? String(fm.ends_on) : '';
  if (st === 'ended') return { key: 'ended', label: 'Closed', cls: 'plain' };
  if (st === 'paused') return { key: 'paused', label: 'Paused', cls: 'warn' };
  if (opens && opens > today) return { key: 'scheduled', label: 'Opens ' + opens, cls: 'info' };
  if (ends && ends < today) return { key: 'ended', label: 'Closed on ' + ends, cls: 'plain' };
  if (ends) {
    const days = Math.round((new Date(ends) - new Date(today)) / 86400000);
    if (days <= 7) return { key: 'live', label: 'Live, closes ' + (days === 0 ? 'today' : 'in ' + days + ' day' + (days > 1 ? 's' : '')), cls: 'warn' };
    return { key: 'live', label: 'Live until ' + ends, cls: 'ok' };
  }
  return { key: 'live', label: 'Live', cls: 'ok' };
}

async function viewLinks(view) {
  setTitle('Short links', 'Tidy addresses that forward somewhere else, with their own preview.', topActions());
  const items = (await GET('/api/list?kind=links')).items;
  view.append(
    h('div', { class: 'banner', style: { marginBottom: '1rem' } }, h('div', {}, h('b', {}, 'How they work. '), 'Someone opens ' + S.info.site.url.replace('https://', '') + '/your-address/ and is sent on to the destination. Link previews (LinkedIn, WhatsApp, Slack) show the title, text and picture you set here, not the destination\'s. Close a link when it has done its job, or give it dates and it opens and closes by itself.')),
    h('div', { class: 'row between', style: { marginBottom: '1rem' } }, h('span', { class: 'muted' }, items.length + ' short link' + (items.length === 1 ? '' : 's')),
      h('a', { class: 'btn', href: '#/links/new' }, icon('plus'), 'New short link')));
  if (!items.length) { view.append(h('div', { class: 'empty' }, 'No short links yet.')); return; }
  const act = (path, action, ok) => async (e) => { await busy(e.currentTarget, async () => { await POST('/api/link/action', { path, action }); toast(ok, 'ok'); await refreshInfo(); render(); }); };
  view.append(h('div', { class: 'card', style: { padding: 0, overflowX: 'auto' } }, h('table', { class: 't' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Address'), h('th', {}, 'Goes to'), h('th', {}, 'State'), h('th', {}, ''))),
    h('tbody', {}, items.map((it) => {
      const fm = it.front; const st = linkState(fm);
      const full = siteUrl(it.url);
      return h('tr', {},
        h('td', {}, h('div', { class: 't-title' }, fm.title || it.slug), h('div', { class: 'mono small' }, h('a', { href: full, target: '_blank', rel: 'noopener' }, it.url), ' ', h('button', { type: 'button', class: 'btn quiet icon', title: 'Copy the full address', 'aria-label': 'Copy the full address', onclick: () => copyText(full) }, icon('copy')))),
        h('td', {}, h('a', { class: 'ellipsis small', href: fm.destination, target: '_blank', rel: 'noopener', title: fm.destination }, fm.destination || '(none)')),
        h('td', {}, h('span', { class: 'chip ' + st.cls }, st.label)),
        h('td', {}, h('div', { class: 't-actions' },
          h('a', { class: 'btn secondary small', href: '#/links/edit/' + q(it.path) }, 'Edit'),
          st.key === 'live' ? h('button', { type: 'button', class: 'btn quiet small', onclick: act(it.path, 'pause', 'Paused') }, 'Pause') : null,
          st.key === 'paused' || (st.key === 'ended' && fm.status === 'ended') ? h('button', { type: 'button', class: 'btn quiet small', onclick: act(it.path, 'resume', 'Link is live again') }, st.key === 'paused' ? 'Resume' : 'Reopen') : null,
          st.key !== 'ended' ? h('button', { type: 'button', class: 'btn quiet small', onclick: async (e) => { if (await confirmDialog('Close this link?', 'People who open it will see a "closed" message instead of being sent on. The address keeps working, so old shares stay friendly. You can reopen it later.', 'Close it')) act(it.path, 'end', 'Closed')(e); } }, 'Close') : null,
          h('button', { type: 'button', class: 'btn quiet small', style: { color: 'var(--danger)' }, onclick: () => deleteLinkDialog(it) }, 'Delete'))));
    })))));
}

function deleteLinkDialog(it) {
  openModal({
    title: 'Delete ' + it.url + '?',
    body: h('div', { class: 'stack' }, h('p', {}, 'Deleting removes the address completely. Anyone who still has the link will see "page not found".'), h('p', { class: 'muted' }, 'If you only want it to stop working nicely, press Close instead: the address stays and shows a polite message. A backup copy of the file is kept on this computer either way.')),
    actions: [{ label: 'Keep it', kind: 'secondary' }, { label: 'Delete for good', kind: 'danger solid', close: false, onclick: async (b, close) => {
      try { await POST('/api/doc/delete', { path: it.path }); toast('Deleted'); close(); await refreshInfo(); render(); } catch (e) { fail(e); }
      return false;
    } }]
  });
}

async function viewLinkEdit(view, path) {
  const isNew = !path;
  let doc = null; let fm = {}; let raw = ''; let mtime = null; let explainer = '';
  if (!isNew) { doc = await GET('/api/doc?path=' + q(path)); fm = doc.front; raw = doc.front_raw; mtime = doc.mtime; explainer = doc.body.trim(); }
  const known = ['/', '/research/', '/about/', '/cv/', '/publications/', '/writing/'];
  try { (await GET('/api/list?kind=projects')).items.forEach((i) => i.url && known.push(i.url)); (await GET('/api/list?kind=writing')).items.forEach((i) => i.url && known.push(i.url)); } catch (e) { /* optional */ }

  const f = {
    path: isNew ? '' : (fm.permalink || '').replace(/^\/|\/$/g, ''),
    destination: fm.destination || '', title: fm.title || '', description: String(fm.description || '').replace(/\s+/g, ' ').trim(), label: fm.label || '',
    image_path: fm.image && fm.image.path ? fm.image.path : '', image_alt: fm.image && fm.image.alt ? fm.image.alt : '', image_w: fm.image && fm.image.width, image_h: fm.image && fm.image.height,
    opens_on: fm.opens_on ? String(fm.opens_on) : '', ends_on: fm.ends_on ? String(fm.ends_on) : '',
    after_end: fm.after_end || 'message', fallback_url: fm.fallback_url || '/', fallback_label: fm.fallback_label || '',
    ended_title: fm.ended_title || '', ended_message: fm.ended_message || '', paused_message: fm.paused_message || '', explainer
  };
  setTitle(isNew ? 'New short link' : f.title || 'Edit short link', isNew ? 'Choose the address, where it goes, and how it looks when shared.' : siteUrl('/' + f.path + '/'), topActions());
  const dirty = () => { setDirty(true); saveBtn.disabled = false; };
  const mk = (key, props = {}) => { const inp = h('input', { type: props.type || 'text', value: f[key] || '', placeholder: props.placeholder || '', list: props.list, readOnly: props.readOnly, oninput: () => { f[key] = inp.value; dirty(); refresh(); } }); return inp; };
  const box = (label, control, hint, wide) => h('div', { class: 'field' + (wide ? ' wide' : '') }, h('div', { class: 'lbl' }, label), control, hint ? h('div', { class: 'hint' }, hint) : null);

  const addr = isNew ? h('div', { class: 'input-group' }, h('span', { class: 'prefix' }, S.info.site.url.replace('https://', '') + '/'), mk('path', { placeholder: 'survey' }))
    : h('div', { class: 'input-group' }, h('span', { class: 'prefix' }, S.info.site.url.replace('https://', '') + '/'), mk('path', { readOnly: true }));
  const dest = mk('destination', { type: 'url', placeholder: 'https://' });
  const checkOut = h('span', { class: 'small' });
  const checkBtn = h('button', { type: 'button', class: 'btn secondary small', onclick: () => busy(checkBtn, async () => {
    const r = await POST('/api/link/check', { url: f.destination });
    checkOut.className = 'small ' + (r.ok ? '' : 'err'); checkOut.style.color = r.ok ? 'var(--ok)' : 'var(--danger)';
    checkOut.textContent = r.ok ? 'It answers (status ' + r.status + (r.location ? ', then moves on to another address' : '') + ').' : 'It did not answer properly' + (r.status ? ' (status ' + r.status + ')' : '') + (r.error ? ': ' + r.error : '') + '.';
  }, 'Checking…') }, 'Check that it works');
  const title = mk('title'); const label = mk('label', { placeholder: 'the survey' });
  const descTa = h('textarea', { rows: 3, value: f.description, oninput: () => { f.description = descTa.value; dirty(); refresh(); } });
  const imgInp = mk('image_path', { placeholder: '/assets/images/…' });
  const imgNote = h('div', { class: 'hint' });
  const imgPick = h('button', { type: 'button', class: 'btn secondary small', onclick: () => pickMedia((m) => { f.image_path = m.path; f.image_w = m.width; f.image_h = m.height; imgInp.value = m.path; dirty(); refresh(); }) }, 'Choose…');
  const imgAlt = mk('image_alt');
  const opens = h('input', { type: 'date', value: f.opens_on, oninput: () => { f.opens_on = opens.value; dirty(); } });
  const ends = h('input', { type: 'date', value: f.ends_on, oninput: () => { f.ends_on = ends.value; dirty(); } });
  const afterSel = h('select', { onchange: () => { f.after_end = afterSel.value; dirty(); } }, h('option', { value: 'message', selected: f.after_end === 'message' }, 'Show a "closed" message'), h('option', { value: 'forward', selected: f.after_end === 'forward' }, 'Send people to the fallback page'));
  const fbUrl = mk('fallback_url', { list: 'known-pages' });
  const fbLabel = mk('fallback_label', { placeholder: 'read more about the study' });
  const pausedMsg = mk('paused_message'); const endedMsg = mk('ended_message');
  const explainTa = h('textarea', { rows: 3, value: f.explainer, oninput: () => { f.explainer = explainTa.value; dirty(); } });

  const card = { img: h('div', { class: 'img' }), t: h('b'), d: h('span'), dom: h('small') };
  function refresh() {
    clear(card.img);
    if (f.image_path) card.img.append(h('img', { src: mediaUrl(f.image_path), alt: '' })); else card.img.append('Link-preview picture');
    card.t.textContent = f.title || 'Title'; card.d.textContent = (f.description || '').slice(0, 130);
    card.dom.textContent = S.info.site.url.replace('https://', '') + '/' + (f.path || '…') + '/';
    imgNote.textContent = f.image_path ? (f.image_w ? 'This picture is ' + f.image_w + ' × ' + f.image_h + '.' + (f.image_w === 1200 && f.image_h === 630 ? ' That is the ideal size.' : ' The ideal size is 1200 × 630 pixels; other shapes get cropped.') : '') : 'Without a picture, the site\'s default one is used.';
  }
  const saveBtn = h('button', { type: 'button', class: 'btn', disabled: !isNew }, isNew ? 'Create the link' : 'Save changes');
  saveBtn.onclick = () => busy(saveBtn, async () => {
    if (isNew) {
      const r = await POST('/api/doc/create', { kind: 'links', path: f.path, destination: f.destination, title: f.title, description: f.description, label: f.label,
        opens_on: f.opens_on, ends_on: f.ends_on, fallback_url: f.fallback_url, fallback_label: f.fallback_label, after_end: f.after_end,
        ended_message: f.ended_message, paused_message: f.paused_message, explainer: f.explainer,
        image_path: f.image_path, image_width: f.image_w, image_height: f.image_h, image_alt: f.image_alt });
      setDirty(false); toast('Link created. Publish to make it work on the web.', 'ok'); await refreshInfo(); go('/links');
    } else {
      let t = raw;
      t = setField(t, 'title', 'str', f.title); t = setField(t, 'description', 'folded', f.description);
      t = setField(t, 'destination', 'str', f.destination); t = setField(t, 'label', 'str', f.label);
      t = setField(t, 'opens_on', 'date', f.opens_on, true); t = setField(t, 'ends_on', 'date', f.ends_on, true);
      t = setField(t, 'after_end', 'str', f.after_end); t = setField(t, 'fallback_url', 'str', f.fallback_url); t = setField(t, 'fallback_label', 'str', f.fallback_label);
      t = setField(t, 'ended_title', 'str', f.ended_title); t = setField(t, 'ended_message', 'str', f.ended_message); t = setField(t, 'paused_message', 'str', f.paused_message);
      t = setNested(t, 'image', 'path', 'str', f.image_path); t = setNested(t, 'image', 'width', 'num', f.image_path ? f.image_w : ''); t = setNested(t, 'image', 'height', 'num', f.image_path ? f.image_h : ''); t = setNested(t, 'image', 'alt', 'str', f.image_alt);
      if (!f.image_path) t = removeKey(t, 'image');
      const r = await PUT('/api/doc', { path, front_raw: t, body: f.explainer ? f.explainer + '\n' : '', mtime, has_front: true });
      raw = t; mtime = r.mtime; setDirty(false); saveBtn.disabled = true; toast('Saved. Publish to put the change on the web.', 'ok'); await refreshInfo();
    }
  }, 'Saving…');

  refresh();
  view.append(h('datalist', { id: 'known-pages' }, known.map((u) => h('option', { value: u }))),
    h('div', { class: 'editor' },
      h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('h2', {}, 'Where it goes'), h('div', { class: 'fields', style: { marginTop: '.8rem' } },
          box('Short address', addr, isNew ? 'Lowercase letters, numbers and dashes. Use / for a second part, like siwes/survey.' : 'The address cannot be changed once it has been shared. Make a new link if you need a different one.', true),
          box('Destination', h('div', {}, dest, h('div', { class: 'row', style: { marginTop: '.5rem' } }, checkBtn, checkOut)), 'Must start with https://', true),
          box('What the destination is called', label, 'Used in "Taking you to the survey…".'))),
        h('div', { class: 'card' }, h('h2', {}, 'How it looks when shared'), h('p', { class: 'sub' }, 'This is what LinkedIn, WhatsApp and Slack show. It does not have to match the destination.'),
          h('div', { class: 'fields' }, box('Title', title, null, true), box('Text under the title', descTa, null, true),
            box('Picture', h('div', {}, h('div', { class: 'pick-row' }, imgInp, imgPick), imgNote), null, true), box('Describe the picture', imgAlt, null, true))),
        h('div', { class: 'card' }, h('h2', {}, 'When it works'), h('p', { class: 'sub' }, 'Optional. The dates are checked every time someone opens the link, so no rebuild is needed.'),
          h('div', { class: 'fields' }, box('Opens on', opens, 'Before this day people see "not open yet".'), box('Closes after', ends, 'The last day it works.'),
            box('When it has closed', afterSel, null, true),
            box('Fallback page', fbUrl, 'Where people can go instead.'), box('Fallback link wording', fbLabel, 'For example: read more about the study.'),
            box('Message before it opens', pausedMsg, null, true), box('Message after it closes', endedMsg, null, true))),
        h('div', { class: 'card' }, h('h2', {}, 'A line for people before they are forwarded'), h('p', { class: 'sub' }, 'Optional. Shown for a moment while the page redirects, and to anyone who has scripts turned off.'), explainTa)),
      h('div', { class: 'editor-side' },
        h('div', { class: 'card' }, h('div', { class: 'row' }, saveBtn, h('a', { class: 'btn quiet', href: '#/links' }, 'Back')),
          !isNew ? h('div', { class: 'small muted', style: { marginTop: '.7rem' } }, 'Full address: ', h('span', { class: 'mono' }, siteUrl('/' + f.path + '/')), ' ', h('button', { type: 'button', class: 'btn quiet icon', onclick: () => copyText(siteUrl('/' + f.path + '/')) }, icon('copy'))) : null),
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Preview when shared'), h('div', { class: 'share-card' }, card.img, h('div', { class: 'meta' }, card.dom, card.t, card.d))))));
}
