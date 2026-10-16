'use strict';
/* Preview and checks, publishing, and the file browser. */

/* ── Preview and checks ── */
function issueRow(i) {
  const chip = i.level === 'error' ? h('span', { class: 'chip bad' }, 'Fix') : i.level === 'warn' ? h('span', { class: 'chip warn' }, 'Improve') : h('span', { class: 'chip info' }, 'Idea');
  return h('div', { class: 'issue' }, h('div', {}, chip), h('div', {}, h('div', {}, h('span', { class: 'pg' }, i.page), ' ', i.message), i.fix ? h('div', { class: 'fix' }, i.fix) : null));
}
async function viewChecks(view) {
  if (window.WEB_MODE) { setTitle('Preview and checks', 'Only on your computer.', topActions()); view.append(h('div', { class: 'card' }, h('p', {}, 'Previewing and the full site check need the console on your computer. In the browser version, edits go live a minute or two after you publish.'))); return; }
  setTitle('Preview and checks', 'See the site as visitors will, and check it for search and AI.', topActions());
  const pvCard = h('div', { class: 'card' });
  const drawPreview = (pv) => {
    clear(pvCard);
    pvCard.append(h('h2', {}, 'Live preview'),
      h('p', { class: 'sub' }, 'Runs a private copy of your site on this computer. It refreshes by itself when you save. Nobody else can see it.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: (e) => busy(e.currentTarget, async () => { const r = await POST(pv.running ? '/api/preview/stop' : '/api/preview/start'); await refreshInfo(); drawPreview(r); if (!pv.running && r.running) window.open(r.url, '_blank'); }, pv.running ? 'Stopping…' : 'Starting (about 10 seconds)…') }, icon('eye'), pv.running ? 'Stop the preview' : 'Start the preview'),
        pv.running ? h('a', { class: 'btn secondary', href: pv.url, target: '_blank', rel: 'noopener' }, 'Open ', h('span', { class: 'mono' }, pv.url)) : null,
        pv.running ? h('span', { class: 'chip ok' }, 'Running') : h('span', { class: 'chip plain' }, 'Stopped')),
      pv.log ? h('details', { style: { marginTop: '1rem' }, open: !pv.running }, h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, 'What Jekyll says'), h('pre', { class: 'log', style: { marginTop: '.6rem' } }, pv.log)) : null);
  };
  drawPreview((await GET('/api/preview')));

  const results = h('div');
  const runBtn = h('button', { type: 'button', class: 'btn' }, icon('check'), 'Build and check');
  let filter = 'all'; let last = null;
  const drawResults = (res) => {
    last = res; clear(results);
    if (!res) { results.append(h('p', { class: 'muted' }, 'Nothing checked yet.')); return; }
    if (res.build && !res.build.ok) {
      results.append(h('div', { class: 'banner bad' }, h('div', {}, h('b', {}, 'The site would not build. '), 'Here is what Jekyll said:')), h('pre', { class: 'log', style: { marginTop: '.6rem' } }, res.build.output));
    }
    const c = res.counts || { error: 0, warn: 0, info: 0 };
    results.append(h('div', { class: 'row', style: { margin: '.4rem 0 1rem' } },
      [['all', 'All ' + (c.error + c.warn + c.info)], ['error', c.error + ' to fix'], ['warn', c.warn + ' to improve'], ['info', c.info + ' ideas']].map(([k, l]) =>
        h('button', { type: 'button', class: 'btn small ' + (filter === k ? '' : 'secondary'), onclick: () => { filter = k; drawResults(last); } }, l)),
      res.pages ? h('span', { class: 'muted small' }, res.pages + ' pages looked at') : null));
    const list = (res.issues || []).filter((i) => filter === 'all' || i.level === filter);
    if (res.counts && !res.issues.length) results.append(h('div', { class: 'banner ok' }, 'No problems found. Titles, descriptions, links and structured data all look right.'));
    else if (!list.length) results.append(h('p', { class: 'muted' }, 'Nothing in this group.'));
    else results.append(h('div', {}, list.map(issueRow)));
  };
  runBtn.onclick = () => busy(runBtn, async () => { const r = await POST('/api/audit'); drawResults(r); await refreshInfo(); }, 'Building…');
  view.append(pvCard, h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', {}, 'Check the site'), runBtn),
    h('p', { class: 'sub' }, 'Builds the site the way GitHub will, then checks titles, descriptions, link-preview pictures, headings, broken links, structured data, robots rules and the sitemap. Nothing is changed.'), results));
  drawResults((await GET('/api/audit/last')).counts ? await GET('/api/audit/last') : null);
}

/* ── Publish ── */
async function viewPublish(view) {
  setTitle('Publish', 'Send your changes to GitHub, which rebuilds the site.', topActions());
  const git = await GET('/api/git');
  if (!git.repo) {
    view.append(h('div', { class: 'banner bad' }, 'This folder is not a Git repository, so there is nowhere to publish to. Open the folder with GitHub Desktop or run "git init" and connect it to your GitHub project.'));
    return;
  }
  const changes = git.changes;
  const msg = h('textarea', { rows: 2, placeholder: 'What did you change? For example: Add my new paper and close the survey link' });
  const guess = () => {
    const parts = [];
    const has = (re) => changes.some((c) => re.test(c.path));
    if (has(/^_data\/cv/)) parts.push('Update CV'); if (has(/^_data\/publications/)) parts.push('Update publications');
    if (has(/^_projects\//)) parts.push('Update projects'); if (has(/^_writing\//)) parts.push('Update writing'); if (has(/^_links\//)) parts.push('Update short links');
    if (has(/^assets\/images/)) parts.push('Update pictures'); if (has(/^_data\/home/)) parts.push('Update home page'); if (has(/^_data\/(identity|ai_bots|social|authors)/)) parts.push('Update identity settings');
    return parts.join(', ') || (changes.length ? 'Update site' : '');
  };
  msg.value = guess();
  const out = h('div'); const pubBtn = h('button', { type: 'button', class: 'btn', disabled: !changes.length }, icon('upload'), git.mode === 'pull_request' ? 'Send for approval' : 'Publish to the web');
  const pullBtn = h('button', { type: 'button', class: 'btn secondary small' }, 'Get the latest from GitHub');
  const showSteps = (res) => {
    clear(out);
    out.append(h('div', { class: 'card steps', style: { marginTop: '1rem' } }, h('h2', {}, res.ok ? 'Sent' : 'Something went wrong'),
      res.steps.map((s) => h('div', { class: 'step ' + (s.ok ? 'ok' : 'bad') }, h('div', { class: 'ico' }, s.ok ? '✓' : '!'), h('div', { style: { minWidth: 0 } }, h('b', {}, s.name), s.output ? h('pre', { class: 'log', style: { marginTop: '.4rem', maxHeight: '9rem' } }, s.output) : null))),
      res.ok && res.pr_url ? h('div', { class: 'banner ok', style: { marginTop: '1rem' } }, h('div', {}, h('b', {}, 'Sent for your approval. Nothing is live yet. '), 'Open the pull request on GitHub, look over the changes, and press "Merge pull request". GitHub then rebuilds the site (one to two minutes). ', h('a', { href: res.pr_url, target: '_blank', rel: 'noopener' }, 'Open the pull request'), '.'))
      : res.ok ? h('div', { class: 'banner ok', style: { marginTop: '1rem' } }, h('div', {}, 'GitHub is now rebuilding the site. It usually takes one to two minutes. ', git.actions_url ? h('a', { href: git.actions_url, target: '_blank', rel: 'noopener' }, 'Watch it here') : null, '. The CV PDF is remade as part of the same run.')) : null));
  };
  pubBtn.onclick = () => busy(pubBtn, async () => {
    let r = await POST('/api/git/publish', { message: msg.value });
    if (r.blocked) {
      const go2 = await new Promise((resolve) => { let ans = false; openModal({ title: 'Fix these first', body: h('div', {}, h('p', { class: 'muted' }, 'The console found mistakes that would break or damage the site:'), h('div', {}, r.issues.map(issueRow))), actions: [{ label: 'Go back and fix', kind: 'secondary', onclick: () => { ans = false; resolve(false); } }, { label: 'Publish anyway', kind: 'danger', onclick: () => { ans = true; resolve(true); } }], onClose: () => resolve(ans) }); });
      if (!go2) return;
      r = await POST('/api/git/publish', { message: msg.value, force: true });
    }
    showSteps(r); await refreshInfo(); if (r.ok) drawList(await GET('/api/git'));
    renderIndexNow(indexBox);
  }, 'Publishing…');
  pullBtn.onclick = () => busy(pullBtn, async () => { const r = await POST('/api/git/pull'); showSteps(r); await refreshInfo(); toast(r.ok ? 'Up to date' : 'Could not update', r.ok ? 'ok' : 'bad'); });

  const prBanners = h('div');
  if (git.pr) prBanners.append(h('div', { class: 'banner info', style: { marginBottom: '.8rem' } }, h('div', {}, h('b', {}, 'Waiting for your approval: pull request #' + git.pr.number + '. '), 'Your earlier changes are not live yet. New ones are added to the same request. ', h('a', { href: git.pr.url, target: '_blank', rel: 'noopener' }, 'Open it on GitHub'), ' and press Merge when you are happy.')));
  if (git.pr_finished) prBanners.append(h('div', { class: 'banner warn', style: { marginBottom: '.8rem' } }, h('div', {}, 'Your last pull request was merged or closed. Press "Get the latest from GitHub" to carry on from the live site.')));
  if (git.mode === 'pull_request' && git.main_protected === false) prBanners.append(h('div', { class: 'banner warn', style: { marginBottom: '.8rem' } }, h('div', {}, h('b', {}, 'Main is not protected. '), 'GitHub reports that anyone with this token can still change the live site directly. Turn on the rule that requires a pull request (steps in GUIDE.md) so every change needs your approval.')));
  if (git.mode === 'pull_request' && git.main_protected === true) prBanners.append(h('div', { class: 'banner ok', style: { marginBottom: '.8rem' } }, h('div', {}, 'Main is protected: nothing reaches the live site without a pull request.')));
  const listBox = h('div');
  const drawList = (g) => {
    clear(listBox);
    const ch = g.changes || [];
    if (g.private_drafts && g.private_drafts.length) listBox.append(h('div', { class: 'banner info', style: { marginBottom: '.8rem' } }, h('div', {}, h('b', {}, g.private_drafts.length + ' draft' + (g.private_drafts.length === 1 ? '' : 's') + ' kept ' + (window.WEB_MODE ? 'in this browser' : 'on this computer') + '. '), 'Drafts are never sent to the public repository. Turn on "Published" in the editor when one is ready.')));
    listBox.append(ch.length ? h('ul', { class: 'filelist' }, ch.map((c) => h('li', {}, h('span', { class: 'chip plain ' + (c.label === 'new' ? 'ok' : c.label === 'deleted' ? 'bad' : 'info') }, c.label), h('span', { class: 'mono' }, c.path)))) : h('div', { class: 'empty' }, 'Nothing to publish. Everything here is already on GitHub.'));
    pubBtn.disabled = !ch.length;
  };
  drawList(git);
  view.append(h('div', { class: 'grid cols-2' },
    h('div', { class: 'card' }, h('h2', {}, window.WEB_MODE ? 'Changes not yet published' : 'Changes on this computer'), h('p', { class: 'sub' }, git.branch ? 'Branch: ' + git.branch + (git.remote ? ' · ' + git.remote : '') : ''),
      prBanners,
      listBox,
      git.behind > 0 ? h('div', { class: 'banner warn', style: { marginTop: '1rem' } }, h('div', {}, 'GitHub has ' + git.behind + ' newer change' + (git.behind > 1 ? 's' : '') + ' that this computer does not have. Get them before you publish.', git.mode === 'pull_request' ? null : h('div', { style: { marginTop: '.5rem' } }, pullBtn))) : null),
    h('div', { class: 'card' }, h('h2', {}, 'Publish'), h('p', { class: 'sub' }, git.mode === 'pull_request' ? 'This saves a version and sends it to GitHub as a pull request. Nothing goes live until you approve and merge it there.' : 'This saves a version, sends it to GitHub, and GitHub rebuilds the site.'),
      h('div', { class: 'field' }, h('label', {}, 'Note about this update'), msg, h('div', { class: 'hint' }, 'Only for your own history. Visitors never see it.')), h('div', { style: { marginTop: '1rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap' } }, pubBtn, git.mode === 'pull_request' ? pullBtn : null))), out);

  const indexBox = h('div'); view.append(indexBox);
  renderIndexNow(indexBox);
}

async function renderIndexNow(box) {
  clear(box);
  const info = await GET('/api/indexnow');
  const card = h('div', { class: 'card', style: { marginTop: '1rem' } }, h('h2', {}, 'Tell search engines'),
    h('p', { class: 'sub' }, 'IndexNow tells Bing, Yandex, Seznam and other participating search engines that your pages changed, so they look straight away. (Google does not use IndexNow. It finds changes through the sitemap and Search Console.) Wait until GitHub has finished rebuilding, then send.'));
  if (!info.key) {
    card.append(h('p', {}, 'First, a one-time setup creates a small key file in your site. It is published with your next update.'), h('button', { type: 'button', class: 'btn secondary', onclick: (e) => busy(e.currentTarget, async () => { await POST('/api/indexnow/setup'); toast('Key created. Publish once so the key file goes live, then come back.', 'ok', 7000); await refreshInfo(); renderIndexNow(box); }) }, 'Set up IndexNow'));
  } else {
    const built = await GET('/api/built?name=sitemap.xml');
    let urls = [siteUrl('/')];
    if (built.text) urls = Array.from(built.text.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]).filter((u) => !/\.pdf$/.test(u));
    const ta = h('textarea', { rows: 6, class: 'mono', value: urls.join('\n') });
    card.append(h('p', { class: 'small muted' }, 'Key file: /' + info.key + '.txt. ' + (built.text ? 'Addresses taken from your sitemap.' : 'Run a check on the Preview and checks screen to fill in every page. For now this lists your home page.')), ta,
      h('div', { style: { marginTop: '.8rem' } }, h('button', { type: 'button', class: 'btn', onclick: (e) => busy(e.currentTarget, async () => {
        const r = await POST('/api/indexnow/submit', { urls: ta.value.split('\n').map((s) => s.trim()).filter(Boolean) });
        toast(r.ok ? 'Sent to search engines (' + r.status + ')' : 'Not accepted: ' + r.status + ' ' + (r.body || ''), r.ok ? 'ok' : 'bad', 8000);
      }, 'Sending…') }, 'Send the addresses')));
  }
  box.append(card);
}

/* ── Files ── */
async function viewFiles(view, current) {
  setTitle('All files', 'For anything the other screens do not cover. Be careful: this edits the source directly.', topActions());
  const { files } = await GET('/api/files');
  const list = h('div', { class: 'card', style: { padding: '.6rem', maxHeight: '70vh', overflow: 'auto' } });
  const search = h('input', { type: 'text', placeholder: 'Find a file…', 'aria-label': 'Find a file' });
  const draw = () => {
    clear(list); const term = search.value.toLowerCase();
    files.filter((f) => f.toLowerCase().includes(term)).forEach((f) => list.append(h('a', { href: '#/files/' + q(f), class: 'nav-item', style: { color: f === current ? 'var(--accent)' : 'var(--ink)', fontWeight: f === current ? 700 : 400, fontSize: '.88rem', wordBreak: 'break-all' }, 'aria-current': f === current ? 'page' : null }, f)));
  };
  search.addEventListener('input', draw); draw();
  const right = h('div');
  view.append(h('div', { style: { display: 'grid', gridTemplateColumns: '18rem minmax(0, 1fr)', gap: '1.2rem', alignItems: 'start' } }, h('div', {}, search, h('div', { style: { height: '.5rem' } }), list), right));
  if (!current) { right.append(h('div', { class: 'empty' }, 'Choose a file on the left.')); return; }
  const doc = await GET('/api/doc?path=' + q(current));
  let fm = doc.front_raw; let mtime = doc.mtime; let has = doc.has_front;
  const fmArea = h('textarea', { class: 'yaml-area', rows: 10, value: fm, spellcheck: 'false' });
  const bodyArea = h('textarea', { class: 'yaml-area', rows: 28, value: doc.body, spellcheck: 'false', style: { minHeight: '24rem' } });
  const saveBtn = h('button', { type: 'button', class: 'btn', disabled: true }, 'Save');
  const note = h('span', { class: 'small muted' }, '');
  const mark = () => { setDirty(true); saveBtn.disabled = false; note.textContent = 'Unsaved changes'; };
  fmArea.addEventListener('input', mark); bodyArea.addEventListener('input', mark);
  [fmArea, bodyArea].forEach((a) => a.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); a.setRangeText('  ', a.selectionStart, a.selectionEnd, 'end'); mark(); } }));
  saveBtn.onclick = () => busy(saveBtn, async () => { const r = await PUT('/api/doc', { path: current, front_raw: fmArea.value, body: bodyArea.value, mtime, has_front: has }); mtime = r.mtime; setDirty(false); saveBtn.disabled = true; note.textContent = 'Saved'; toast('Saved', 'ok'); await refreshInfo(); }, 'Saving…');
  right.append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', { class: 'mono', style: { fontSize: '1rem' } }, current), h('div', { class: 'row' }, note, saveBtn)),
    has ? h('div', { class: 'stack', style: { marginTop: '1rem' } }, h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Front matter'), fmArea), h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Content'), bodyArea))
      : h('div', { style: { marginTop: '1rem' } }, bodyArea)));
}
