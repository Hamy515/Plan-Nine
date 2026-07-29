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
})();
