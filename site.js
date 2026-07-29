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
  const embedSrc = (ref) => {
    const [provider, id] = ref.split(':');
    return provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`
      : `https://player.vimeo.com/video/${id}?autoplay=1&playsinline=1&title=0&byline=0&portrait=0&dnt=1`;
  };

  document.querySelectorAll('[data-trailer]').forEach(btn => {
    btn.addEventListener('click', () => {
      const article = btn.closest('article');
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
      iframe.src = embedSrc(btn.dataset.trailer);
      iframe.title = `${title ? title.textContent.trim() : 'Film'} — trailer`;
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.setAttribute('allowfullscreen', '');
      frame.appendChild(iframe);
      frame.classList.add('is-playing');
    });
  });
})();
