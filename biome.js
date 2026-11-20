(() => {
  'use strict';
  const title = document.querySelector('.redesign-header-title');
  const wordmark = document.createElement('span');
  wordmark.className = 'biome-wordmark';
  wordmark.textContent = 'Daily English';
  title.prepend(wordmark);

  const destinations = document.createElement('section');
  destinations.id = 'biome-media';
  destinations.setAttribute('aria-label', 'Материалы и практика');
  destinations.innerHTML = [
    ['textbook', 'assets/study.jpg', 'Учебник и план'],
    ['practice', 'assets/landscape.jpg', 'Практика навыков']
  ].map(([view, photo, caption]) =>
    '<button type="button" class="biome-destination" data-biome-view="' + view +
    '"><img src="' + photo + '" alt="" width="1200" height="600"><span>' +
    caption + '</span></button>'
  ).join('');
  document.getElementById('redesign-home').prepend(destinations);
  destinations.addEventListener('click', event => {
    const button = event.target.closest('[data-biome-view]');
    if (button) window.showView(button.dataset.biomeView);
  });

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
})();

