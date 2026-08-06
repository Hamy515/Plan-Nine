/* Shared site behavior: mobile menu, reveal observer, active-nav highlight */
(function () {
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    mobileMenu.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => mobileMenu.classList.add('hidden'))
    );
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll('.reveal, .laurel').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal, .laurel').forEach(el => el.classList.add('is-visible'));
  }

  // Active nav highlight
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.getAttribute('data-nav') === path) a.classList.add('active');
  });

  // Inline trailers (/work): play the film in its own still's frame.
  const embedSrc = (id) =>
    `https://player.vimeo.com/video/${id}?autoplay=1&playsinline=1&title=0&byline=0&portrait=0&dnt=1`;

  const playTrailer = (article, ref) => {
    const frame = article && article.querySelector('.frame');
    if (!frame || frame.classList.contains('is-playing')) return;

    // One at a time — two trailers playing means two soundtracks at once.
    document.querySelectorAll('.frame.is-playing').forEach(open => {
      open.classList.remove('is-playing');
      const playing = open.querySelector('iframe');
      if (playing) playing.remove();
    });

    const title = article.querySelector('h3');
    const iframe = document.createElement('iframe');
    iframe.src = embedSrc(ref);
    iframe.title = `${title ? title.textContent.trim() : 'Film'} — trailer`;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.setAttribute('allowfullscreen', '');
    frame.appendChild(iframe);
    frame.classList.add('is-playing');
  };

  document.querySelectorAll('[data-trailer]').forEach(btn => {
    const article = btn.closest('article');
    const frame = article && article.querySelector('.frame');
    const ref = btn.dataset.trailer;
    btn.addEventListener('click', () => playTrailer(article, ref));
    if (!frame) return;

    // Second way in, over the still itself. Hidden from assistive tech and
    // skipped in the tab order — the pill already exposes this action once.
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'frame-play';
    overlay.tabIndex = -1;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<span class="frame-play__disc"></span>';
    overlay.addEventListener('click', () => playTrailer(article, ref));
    frame.appendChild(overlay);
  });

  // Jump to a film's card and start it. Used by the hero pill here and by the
  // home page, which links across as work.html#watch-<id>.
  const playFilmById = (id, smooth) => {
    const btn = document.querySelector(`[data-trailer="${id}"]`);
    const article = btn && btn.closest('article');
    if (!article) return false;
    // 'instant' is explicit: html sets scroll-behavior:smooth, and animating
    // the whole way down on arrival is slow and lands short if interrupted.
    article.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'center' });
    playTrailer(article, id);
    return true;
  };

  const heroPill = document.getElementById('wkFilmLink');
  if (heroPill) {
    heroPill.addEventListener('click', (e) => {
      // Fall through to the plain anchor jump if the card isn't there.
      if (playFilmById(heroPill.dataset.trailerTarget, true)) e.preventDefault();
    });
  }

  const arriving = /^#watch-(\d+)$/.exec(location.hash);
  if (arriving) {
    const id = arriving[1];
    const reAnchor = () => {
      const btn = document.querySelector(`[data-trailer="${id}"]`);
      const article = btn && btn.closest('article');
      if (article) article.scrollIntoView({ behavior: 'instant', block: 'center' });
    };
    requestAnimationFrame(() => {
      playFilmById(id, false);
      // Stills above this card load after the jump and push it down. Re-anchor
      // a couple of times rather than waiting on window.load, which would also
      // wait for the Vimeo backplate in the hero.
      setTimeout(reAnchor, 250);
      setTimeout(reAnchor, 900);
    });
  }
})();
