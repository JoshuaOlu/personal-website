'use strict';
/* Menu, routes and start-up. */

const NAV = [
  ['', [['/', 'Overview', 'home']]],
  ['Content', [['/projects', 'Projects', 'folder'], ['/writing', 'Writing', 'pen'], ['/series', 'Series', 'layers'], ['/themes', 'Themes', 'tag'], ['/publications', 'Publications', 'book'], ['/references', 'References', 'quote'], ['/cv', 'CV', 'user'], ['/links', 'Short links', 'link']]],
  ['Site', [['/homepage', 'Home page', 'home'], ['/seo', 'Search and AI', 'globe'], ['/media', 'Media', 'image'], ['/settings', 'Settings', 'gear'], ['/files', 'All files', 'file']]],
  ['Ship', [['/checks', 'Preview and checks', 'check'], ['/publish', 'Publish', 'upload']]]
];
function buildNav() {
  const nav = clear($('#nav'));
  const skip = window.WEB_MODE ? ['/checks'] : [];
  const here = (location.hash || '#/').slice(1) || '/';
  const n = S.info && S.info.git && S.info.git.changes ? S.info.git.changes.length : 0;
  NAV.forEach(([group, items]) => {
    if (group) nav.append(h('div', { class: 'nav-group' }, group));
    items.forEach(([path, label, ic]) => {
      if (skip.includes(path)) return;
      const active = path === '/' ? here === '/' : here === path || here.startsWith(path + '/');
      nav.append(h('a', { class: 'nav-item', href: '#' + path, 'aria-current': active ? 'page' : null }, icon(ic), label,
        path === '/publish' && n ? h('span', { class: 'nav-badge' }, String(n)) : null));
    });
  });
  if (S.info) $('#brand-title').textContent = S.info.site.title || 'Site console';
}

route('/', viewHome);
route('/projects', (v) => viewDocList(v, 'projects'));
route('/projects/edit/(.+)', (v, p) => viewDocEdit(v, 'projects', p));
route('/writing', (v) => viewDocList(v, 'writing'));
route('/writing/edit/(.+)', (v, p) => viewDocEdit(v, 'writing', p));
route('/series', (v) => viewHubList(v, 'series'));
route('/series/edit/(.+)', (v, p) => viewHubEdit(v, 'series', p));
route('/themes', (v) => viewHubList(v, 'themes'));
route('/themes/edit/(.+)', (v, p) => viewHubEdit(v, 'themes', p));
route('/publications', viewPublications);
route('/references', viewReferences);
route('/cv', viewCV);
route('/links', viewLinks);
route('/links/new', (v) => viewLinkEdit(v, null));
route('/links/edit/(.+)', (v, p) => viewLinkEdit(v, p));
route('/homepage', viewHomePage);
route('/seo', (v) => viewSeo(v, 'you'));
route('/seo/(\\w+)', viewSeo);
route('/media', viewMedia);
route('/settings', viewSettings);
route('/files', (v) => viewFiles(v, null));
route('/files/(.+)', (v, p) => viewFiles(v, p));
route('/checks', viewChecks);
route('/publish', viewPublish);

$('#menu-toggle').addEventListener('click', () => document.body.classList.toggle('menu-open'));
$('#quit').addEventListener('click', async () => {
  if (await confirmDialog('Stop the console?', 'The preview will stop too. Your work is saved in the files, and you can start the console again any time.', 'Stop it')) {
    try { await POST('/api/quit'); } catch (e) { /* it is going away */ }
    document.body.innerHTML = '<div style="font-family:system-ui;padding:3rem;max-width:34rem;margin:auto"><h1>The console has stopped</h1><p>You can close this tab. To use it again, open the Start-Console file.</p></div>';
  }
});

(async function start() {
  if (window.WEB_BOOT) await window.WEB_BOOT(); // browser version: sign in first
  await refreshInfo();
  render();
})();
