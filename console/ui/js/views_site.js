'use strict';
/* Media, identity and search settings, site settings. */

/* ── Media ── */
async function uploadFiles(files) {
  let ok = 0; let last = null;
  for (const file of files) {
    if (file.size > 12 * 1024 * 1024) { toast(file.name + ' is over 12 MB. Please shrink it first.', 'bad'); continue; }
    try { last = await api('PUT', '/api/media?name=' + q(file.name), file, { raw: true }); ok++; toast('Added ' + last.path.split('/').pop(), 'ok'); }
    catch (e) { fail(e); }
  }
  return ok ? last : null;
}
function dropZone(onDone) {
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async () => { const r = await uploadFiles(Array.from(input.files)); input.value = ''; if (r) onDone(r); } });
  const zone = h('div', { class: 'drop', tabindex: '0', role: 'button', 'aria-label': 'Add pictures',
    onclick: () => input.click(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
    ondragover: (e) => { e.preventDefault(); zone.classList.add('over'); }, ondragleave: () => zone.classList.remove('over'),
    ondrop: async (e) => { e.preventDefault(); zone.classList.remove('over'); const r = await uploadFiles(Array.from(e.dataTransfer.files)); if (r) onDone(r); } },
    h('b', {}, 'Drop pictures here, or click to choose'), h('div', { class: 'small' }, 'PNG, JPG, GIF, WebP or SVG. Link-preview pictures should be 1200 × 630.'), input);
  return zone;
}
function mediaBadges(m) {
  const out = [];
  if (m.bytes > 600 * 1024) out.push(h('span', { class: 'chip warn plain' }, 'Large'));
  if (m.width === 1200 && m.height === 630) out.push(h('span', { class: 'chip ok plain' }, 'Preview size'));
  return out;
}
async function viewMedia(view) {
  setTitle('Media', 'Pictures used on your pages and in link previews.', topActions());
  const grid = h('div', { class: 'media-grid' });
  const load = async () => {
    const items = (await GET('/api/media')).items;
    clear(grid);
    if (!items.length) grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, 'No pictures yet.'));
    items.forEach((m) => grid.append(h('div', { class: 'media-card' },
      h('div', { class: 'thumb' }, h('img', { src: mediaUrl(m.path), alt: '', loading: 'lazy' })),
      h('div', { class: 'info' }, h('b', { title: m.path }, m.name), h('span', {}, [m.width ? m.width + ' × ' + m.height : null, fmtBytes(m.bytes)].filter(Boolean).join(' · ')), h('div', { style: { marginTop: '.3rem', display: 'flex', gap: '.3rem', flexWrap: 'wrap' } }, mediaBadges(m))),
      h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'btn quiet small', onclick: () => copyText(m.path) }, 'Copy path'),
        h('button', { type: 'button', class: 'btn quiet small', onclick: async () => {
          const refs = (await GET('/api/media/refs?path=' + q(m.path))).refs;
          openModal({ title: 'Where ' + m.name + ' is used', body: refs.length ? h('ul', { class: 'filelist' }, refs.map((r) => h('li', {}, h('span', { class: 'mono' }, r)))) : h('p', {}, 'Nothing refers to this picture.'), actions: [{ label: 'Close' }] });
        } }, 'Where used'),
        h('button', { type: 'button', class: 'btn quiet small', style: { color: 'var(--danger)' }, onclick: async () => {
          const refs = (await GET('/api/media/refs?path=' + q(m.path))).refs;
          if (refs.length) { openModal({ title: 'Still in use', body: h('div', {}, h('p', {}, m.name + ' is used by:'), h('ul', { class: 'filelist' }, refs.map((r) => h('li', {}, h('span', { class: 'mono' }, r)))), h('p', { class: 'muted' }, 'Change those pages first, then delete the picture.')), actions: [{ label: 'OK' }] }); return; }
          if (await confirmDialog('Delete ' + m.name + '?', 'A backup copy is kept on this computer.', 'Delete', true)) { await POST('/api/media/delete', { path: m.path }); toast('Deleted'); load(); refreshInfo(); }
        } }, 'Delete')))));
  };
  view.append(dropZone(() => { load(); refreshInfo(); }), h('div', { style: { height: '1.2rem' } }), grid);
  await load();
}
function pickMedia(onPick) {
  const grid = h('div', { class: 'media-grid' });
  let dlg;
  const load = async () => {
    const items = (await GET('/api/media')).items;
    clear(grid);
    items.forEach((m) => grid.append(h('div', { class: 'media-card pick', tabindex: '0', role: 'button', onclick: () => { dlg.close(); onPick(m); }, onkeydown: (e) => { if (e.key === 'Enter') { dlg.close(); onPick(m); } } },
      h('div', { class: 'thumb' }, h('img', { src: mediaUrl(m.path), alt: '', loading: 'lazy' })),
      h('div', { class: 'info' }, h('b', {}, m.name), h('span', {}, m.width ? m.width + ' × ' + m.height : '')))));
    if (!items.length) grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, 'No pictures yet. Add one above.'));
  };
  dlg = openModal({ title: 'Choose a picture', wide: true, body: h('div', { class: 'stack' }, dropZone(() => load()), grid), actions: [{ label: 'Cancel', kind: 'secondary' }] });
  load();
}

/* ── Search and identity ── */
const SEO_TABS = [
  ['you', 'About you'], ['ai', 'AI access'], ['profiles', 'Profiles'], ['names', 'Name in papers'], ['offsite', 'Get found elsewhere']
];
const CHECKLIST = [
  { id: 'orcid', t: 'Make your ORCID record public and complete', why: 'ORCID is the identifier researchers, publishers and search engines trust most. Add your papers (import by DOI), your site as a website, and your UCT affiliation.', url: 'https://orcid.org/my-orcid', cta: 'Open ORCID' },
  { id: 'scholar', t: 'Create a Google Scholar profile', why: 'This is how people searching for a topic find researchers. Verify it with your UCT email, add both papers, and set your homepage to your website.', url: 'https://scholar.google.com/citations?hl=en', cta: 'Open Google Scholar' },
  { id: 'gsc', t: 'Add your site to Google Search Console and submit the sitemap', why: 'Tells Google the site exists and shows you which searches find it. Add the property for joshua.olunlade.com, verify it, then submit sitemap.xml.', url: 'https://search.google.com/search-console', cta: 'Open Search Console' },
  { id: 'bing', t: 'Add the site to Bing Webmaster Tools', why: 'Bing powers many AI search tools and Copilot. You can import everything from Search Console in one step.', url: 'https://www.bing.com/webmasters', cta: 'Open Bing Webmaster Tools' },
  { id: 'indexnow', t: 'Set up IndexNow on the Publish screen', why: 'After each publish, it tells Bing and other participating search engines straight away instead of waiting for them to find the change.', url: '#/publish', cta: 'Go to Publish' },
  { id: 'uct', t: 'Ask UCT CREE for a student or staff profile page that links to your site', why: 'A link from a university site is one of the strongest signals that you are who you say you are. Ask your supervisors to link your name to your About page.', url: 'https://ebe.uct.ac.za/cree', cta: 'Open the CREE site' },
  { id: 'linkedin', t: 'Put your website in your LinkedIn contact info and Featured section', why: 'LinkedIn ranks highly for your name. Use the same name and a headline with the words "engineering education".', url: 'https://www.linkedin.com/in/joshuaolunlade/', cta: 'Open LinkedIn' },
  { id: 'bios', t: 'Use the same short bio and your website address on Substack, YouTube, X and Instagram', why: 'When many accounts agree about who you are, search engines and AI assistants repeat it with confidence. Copy the bios from your About page.', url: 'about', cta: 'Open the About page' },
  { id: 'preprints', t: 'Put your papers in an open repository (Zenodo or EdArXiv) if the publisher allows it', why: 'Open copies get indexed and cited more, and each gets a DOI. Check the journal\'s rules first. Then add the repository link in Publications.', url: 'https://zenodo.org/', cta: 'Open Zenodo' },
  { id: 'cfk', t: 'Link Care for Knowledge\'s website to your About page, and back', why: 'Links between pages that are about the same person confirm they belong together.', url: 'https://careforknowledge.org/', cta: 'Open the CFK site' },
  { id: 'coauthors', t: 'Ask co-authors and supervisors to link your name to your site from their pages', why: 'Each independent link from a trusted page helps. Send them your About page address.', url: '', cta: '' },
  { id: 'writing', t: 'Publish one piece of writing a month on engineering education in Nigeria and Africa', why: 'Fresh, specific writing is what makes you the answer to a question, not just a name. Cross-post to Substack and mark this site as the original (canonical).', url: '#/writing', cta: 'Go to Writing' },
  { id: 'rich', t: 'Test your structured data', why: 'Paste your home page address into the Rich Results Test and the Schema Markup Validator to see exactly what search engines read about you.', url: 'https://validator.schema.org/', cta: 'Open the validator' }
];
async function viewSeo(view, tab) {
  tab = tab || 'you';
  setTitle('Search and AI visibility', 'How search engines and AI assistants understand and find you.', topActions());
  view.append(h('div', { class: 'tabs', role: 'tablist' }, SEO_TABS.map(([id, label]) => h('a', { class: 'tab', role: 'tab', 'aria-selected': String(id === tab), href: '#/seo/' + id, style: { textDecoration: 'none' } }, label))));
  const body = h('div'); view.append(body);
  if (tab === 'you') {
    await dataPage(body, { name: 'identity', fields: SCHEMA.identity, intro: 'This is the one record search engines and AI assistants read about you. It builds your About page, your structured data and the llms.txt guide. Keep it accurate and specific.' });
  } else if (tab === 'ai') {
    const built = await GET('/api/built?name=robots.txt');
    body.append(h('div', { class: 'card' }, h('h2', {}, 'How it works'),
      h('p', { class: 'sub' }, 'Your site welcomes search engines and AI search tools, and asks AI training crawlers to stay away. This is declared in /robots.txt, in tags on every page, and in a rights-reservation file. All of it is built from the two lists below.'),
      h('div', { class: 'banner warn' }, h('div', {}, h('b', {}, 'Be realistic. '), 'These are requests. Honest companies follow them, and the bigger ones do. A bot that ignores them can only be stopped by the host (GitHub Pages cannot do that). The most reliable protection is to publish only what you are happy to have read.'))),
      h('div', { style: { height: '1rem' } }));
    await dataPage(body, { name: 'ai_bots', fields: SCHEMA.ai_bots });
    body.append(h('div', { class: 'card', style: { marginTop: '1rem', marginBottom: '5rem' } }, h('h2', {}, 'robots.txt as last built'), built.text ? h('pre', { class: 'log' }, built.text) : h('p', { class: 'muted' }, 'Not built yet. Run a check on the "Preview and checks" screen to see it here.')));
  } else if (tab === 'profiles') {
    await dataPage(body, { name: 'social', root: 'array', fields: SCHEMA.social });
  } else if (tab === 'names') {
    await dataPage(body, { name: 'authors', fields: SCHEMA.authors });
  } else {
    const saved = await GET('/api/checklist');
    const done = () => CHECKLIST.filter((c) => saved[c.id]).length;
    const bar = h('div'); const count = h('span', { class: 'muted' });
    const paint = () => { clear(bar); bar.append(h('div', { class: 'progress' }, h('div', { style: { width: Math.round(100 * done() / CHECKLIST.length) + '%' } }))); count.textContent = done() + ' of ' + CHECKLIST.length + ' done'; };
    paint();
    body.append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', {}, 'Be findable beyond your own site'), count), h('p', { class: 'sub' }, 'Search engines trust a person more when other places agree about who they are. These steps happen outside this console. Tick them off as you go.'), bar,
      CHECKLIST.map((c) => {
        const cb = h('input', { type: 'checkbox', checked: !!saved[c.id], onchange: async () => { saved[c.id] = cb.checked; row.classList.toggle('done', cb.checked); paint(); try { await PUT('/api/checklist', { checklist: saved }); } catch (e) { fail(e); } } });
        const row = h('div', { class: 'check-item' + (saved[c.id] ? ' done' : '') }, cb, h('div', {}, h('div', { class: 'ci-t', style: { fontWeight: 650 } }, c.t), h('div', { class: 'muted small' }, c.why)),
          c.url ? h('a', { class: 'btn secondary small', href: c.url === 'about' ? siteUrl('/about/') : c.url, target: c.url.startsWith('#') ? null : '_blank', rel: 'noopener' }, c.cta) : null);
        return row;
      })));
  }
}

/* ── Home page ── */
async function viewHomePage(view) {
  setTitle('Home page', 'Choose what the front page leads with, and the words it uses.', topActions());
  await dataPage(view, { name: 'home', fields: SCHEMA.home });
}

/* ── Site settings ── */
async function viewSettings(view) {
  setTitle('Site settings', 'Name, description, contact address and menu.', topActions());
  const cfg = await GET('/api/config');
  const work = JSON.parse(JSON.stringify(cfg)); const original = JSON.stringify(work);
  const fields = [
    { k: 'title', label: 'Site name' },
    { k: 'tagline', label: 'Tagline', hint: 'Shown after the name in search results when a page has no title of its own.' },
    { k: 'author', label: 'Author' },
    { k: 'email', label: 'Contact email', hint: 'The only place your email lives. The home page, projects and short links all read it from here.', type: 'email' },
    { k: 'url', label: 'Web address', hint: 'Change this only if the domain changes. It must start with https://', validate: (v) => (/^https:\/\/[^/\s]+$/.test(v) ? '' : 'Must look like https://joshua.olunlade.com (no slash at the end).') },
    { k: 'description', label: 'Site description', w: 'area', rows: 4, wide: true, counter: [100, 300], hint: 'The default description for search results and link previews on pages that do not have their own.' },
    { k: 'nav', label: 'Menu', w: 'objlist', addLabel: 'Add a menu item', hint: 'The links in the top bar. Use "Hide until it has content" for a section that is empty at first, like Writing.',
      itemLabel: (n) => ({ main: n.label || 'New item', sub: n.url }), newItem: () => ({ label: '', url: '/' }),
      fields: [{ k: 'label', label: 'Label' }, { k: 'url', label: 'Address', hint: 'Starts with / for a page on this site.' }, { k: 'collection', label: 'Hide until it has content (optional)', w: 'select', options: [{ value: 'writing', label: 'Writing has a published piece' }, { value: 'projects', label: 'Projects has an entry' }] }] }
  ];
  const msg = h('span', { class: 'msg' }, 'No changes yet'); const saveBtn = h('button', { type: 'button', class: 'btn', disabled: true }, 'Save changes');
  const update = () => { const ch = JSON.stringify(work) !== original; setDirty(ch); msg.textContent = ch ? 'You have unsaved changes' : 'All changes saved'; msg.className = 'msg' + (ch ? ' dirty' : ''); saveBtn.disabled = !ch; };
  saveBtn.onclick = () => busy(saveBtn, async () => {
    const payload = { title: work.title, tagline: work.tagline, author: work.author, email: work.email, url: work.url, description: work.description, nav: (work.nav || []).map((n) => ({ label: n.label, url: n.url, collection: n.collection, data: n.data, external: n.external })) };
    await PUT('/api/config', payload); setDirty(false); toast('Saved', 'ok'); await refreshInfo(); render();
  }, 'Saving…');
  view.append(h('div', { class: 'card' }, renderFields(work, fields, update)));
  if (!window.WEB_MODE) { view.append(await publishModeCard()); view.append(await webConsoleCard()); }
  view.append(h('div', { class: 'savebar' }, msg, saveBtn));
}

/* Send changes as a pull request instead of straight to the live site (this computer only). */
async function publishModeCard() {
  const st = await GET('/api/publishmode');
  const card = h('div', { class: 'card', style: { marginTop: '1rem' } });
  card.append(h('h2', {}, 'Send changes as a pull request (optional)'),
    h('p', { class: 'sub' }, 'Instead of going live straight away, "Publish" sends your changes to GitHub as a pull request. Nothing changes on the live site until you open it on GitHub and press Merge. This protects the site if this computer or a token is ever compromised.'),
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: st.mode === 'pull_request', onchange: async (e) => {
      const on = e.target.checked;
      await busy(null, async () => { await PUT('/api/publishmode', { mode: on ? 'pull_request' : 'direct' }); toast(on ? 'On: Publish now sends a pull request.' : 'Off: Publish goes straight to the live site.', 'ok'); await refreshInfo(); });
    } }), h('span', {}, 'Use pull requests on this computer')),
    h('p', { class: 'small muted', style: { marginTop: '.8rem' } }, 'For this to protect the site, also switch on the GitHub rule that requires a pull request for the live branch. The steps are in GUIDE.md ("Make approval compulsory").'));
  return card;
}

/* The optional browser version of this console (off unless you turn it on). */
async function webConsoleCard() {
  const st = await GET('/api/webconsole');
  const card = h('div', { class: 'card', style: { marginTop: '1rem' } });
  const draw = (enabled) => {
    clear(card);
    const addr = siteUrl('/manage/');
    card.append(h('h2', {}, 'Edit from any browser (optional)'),
      h('p', { class: 'sub' }, 'Adds a private page at ', h('span', { class: 'mono' }, addr), ' where you can sign in with a GitHub token and edit the site from any computer or phone, with nothing to install. It is off until you turn it on, and it only changes the live site after you publish.'),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: enabled, onchange: async (e) => {
        const on = e.target.checked;
        if (on && !(await confirmDialog('Turn on the browser version?', 'The page itself is public, but it is useless without a GitHub token made for this repository. Anyone who gets that token can change your site, so use a short expiry and cancel it on GitHub if you lose a device.', 'Turn it on'))) { e.target.checked = false; return; }
        await busy(null, async () => { await PUT('/api/webconsole', { enabled: on }); toast(on ? 'On. It goes live when you publish.' : 'Off. The page is removed when you publish.', 'ok'); await refreshInfo(); draw(on); });
      } }), h('span', {}, enabled ? 'On: available after your next publish' : 'Off: no browser page exists on the site')),
      h('p', { class: 'small muted', style: { marginTop: '.8rem' } }, 'To switch it off everywhere: turn this off and publish (the page disappears), and delete the token at github.com/settings/personal-access-tokens.'));
  };
  draw(!!st.enabled);
  return card;
}
