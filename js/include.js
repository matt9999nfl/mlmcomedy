/* MLM Comedy — shared nav/footer injector.
   Requires the page to be served over http(s) (fetch() cannot read local
   files via file://). Works on `netlify dev`, any static server, and on
   Netlify itself. */
(function () {
  function currentPage() {
    var path = window.location.pathname.split('/').pop();
    return path === '' ? 'index.html' : path;
  }

  function wireNav(root) {
    var page = currentPage();
    var links = root.querySelectorAll('.navlinks a[data-page]');
    var matched = false;
    links.forEach(function (a) {
      if (!matched && a.getAttribute('data-page') === page) {
        a.setAttribute('aria-current', 'page');
        matched = true;
      }
    });

    var burger = root.querySelector('#pwBurgerBtn');
    var navlinks = root.querySelector('#pwNavLinks');
    if (burger && navlinks) {
      burger.addEventListener('click', function () {
        var open = navlinks.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      navlinks.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          navlinks.classList.remove('open');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  function include(selector, url, after) {
    var el = document.querySelector(selector);
    if (!el) return;
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('include fetch failed: ' + url + ' (' + r.status + ')');
        return r.text();
      })
      .then(function (html) {
        el.innerHTML = html;
        if (after) after(el);
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    include('[data-include="nav"]', 'partials/nav.html', wireNav);
    include('[data-include="footer"]', 'partials/footer.html');
  });
})();
