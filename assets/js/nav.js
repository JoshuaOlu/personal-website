// Phone menu: the three-line button opens and closes the links. Without JavaScript the links stay visible.
(function () {
  var nav = document.getElementById('site-nav');
  if (!nav) return;
  var btn = nav.querySelector('.nav-toggle');
  var panel = nav.querySelector('.nav-links');
  if (!btn || !panel) return;
  nav.classList.add('nav-js');
  btn.hidden = false;
  function set(open) {
    nav.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  }
  btn.addEventListener('click', function () { set(!nav.classList.contains('nav-open')); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('nav-open')) { set(false); btn.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('nav-open') && !nav.contains(e.target)) set(false);
  });
  panel.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 760) set(false); });
})();
