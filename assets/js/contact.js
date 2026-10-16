// Puts the email address together only when someone presses a "Write to me" button.
// The address is never written in the page itself, so programs that collect addresses find nothing.
(function () {
  function rev(s) { return String(s || '').split('').reverse().join(''); }
  function addr(el) { return rev(el.getAttribute('data-mu')) + '@' + rev(el.getAttribute('data-md')); }
  document.querySelectorAll('a[data-mu]').forEach(function (a) {
    function arm() { if (!a.getAttribute('data-armed')) { a.setAttribute('data-armed', '1'); a.href = 'mailto:' + addr(a); } }
    ['pointerenter', 'focus', 'touchstart'].forEach(function (ev) { a.addEventListener(ev, arm, { passive: true }); });
    a.addEventListener('click', function (e) { e.preventDefault(); location.href = 'mailto:' + addr(a); });
  });
  document.querySelectorAll('button.mail-copy').forEach(function (b) {
    if (!navigator.clipboard) return;
    b.hidden = false;
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(addr(b)).then(function () {
        var old = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = old; }, 1800);
      });
    });
  });
})();
