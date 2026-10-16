// Essays: marks the section you are reading in the side outline and shows reading progress.
(function () {
  var bar = document.querySelector('.post-progress span');
  var body = document.querySelector('.post-body');
  function progress() {
    if (!bar || !body) return;
    var r = body.getBoundingClientRect();
    var total = r.height - window.innerHeight * 0.6;
    var done = Math.min(1, Math.max(0, (-r.top + window.innerHeight * 0.2) / Math.max(total, 1)));
    bar.style.width = (done * 100).toFixed(1) + '%';
  }
  window.addEventListener('scroll', progress, { passive: true });
  progress();

  var links = document.querySelectorAll('#rail-list a');
  if (!links.length || !('IntersectionObserver' in window)) return;
  var map = {}, targets = [];
  links.forEach(function (a) {
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var el = document.getElementById(id);
    if (el) { map[id] = a; targets.push(el); }
  });
  function mark() {
    var current = null;
    targets.forEach(function (el) { if (el.getBoundingClientRect().top < window.innerHeight * 0.3) current = el; });
    links.forEach(function (a) { a.removeAttribute('aria-current'); });
    if (current && map[current.id]) map[current.id].setAttribute('aria-current', 'true');
  }
  var ticking = false;
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { mark(); ticking = false; }); } }, { passive: true });
  mark();
})();
