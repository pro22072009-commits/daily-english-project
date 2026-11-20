(() => {
  const images = document.querySelectorAll('#biome-media img');
  document.body.style.setProperty('--background-photo', 'url("' + images[1].src + '")');
  document.body.style.setProperty('--background-book', 'url("' + images[0].src + '")');
  const picker = document.createElement('div');
  picker.className = 'background-picker';
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Варианты фона');
  picker.innerHTML = '<span>Фон</span><button type="button" data-background-choice="landscape">Пейзаж</button><button type="button" data-background-choice="book">Книга</button><button type="button" data-background-choice="light">Светло-зелёный</button>';
  function choose(name) {
    document.body.dataset.background = name;
    picker.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.backgroundChoice === name)));
  }
  picker.addEventListener('click', event => {
    const button = event.target.closest('[data-background-choice]');
    if (button) choose(button.dataset.backgroundChoice);
  });
  document.body.prepend(picker);
  choose('landscape');
})();