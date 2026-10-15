// Click-to-play embeds: nothing from the other site loads until the reader presses play.
document.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('.embed-play');
  if (!btn) return;
  var box = btn.closest('.embed-frame');
  var src = box.getAttribute('data-src');
  var ap = box.getAttribute('data-autoplay');
  if (ap) src += (src.indexOf('?') > -1 ? '&' : '?') + ap;
  var f = document.createElement('iframe');
  f.src = src;
  f.title = box.getAttribute('data-title') || 'Embedded media';
  f.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
  f.setAttribute('allowfullscreen', '');
  f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox');
  box.innerHTML = '';
  box.appendChild(f);
  f.focus();
});
