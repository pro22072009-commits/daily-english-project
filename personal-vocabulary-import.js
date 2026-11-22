(() => {
  function mount() {
    const form = document.getElementById('b2-vocabulary-form');
    if (!form || document.getElementById('b2-personal-import')) return;
    const panel = document.createElement('section');
    panel.id = 'b2-personal-import'; panel.className = 'b2-extra';
    panel.innerHTML = '<h3>Импорт личных слов</h3><p class="system-sub">JSON с карточками. Уже добавленные слова и их повторения сохраняются.</p><label>Выбрать JSON <input type="file" accept=".json,application/json"></label><button type="button" class="sys-btn primary">Добавить в мой словарь</button><p role="status" aria-live="polite"></p>';
    form.before(panel);
    panel.querySelector('button').onclick = async () => {
      const file = panel.querySelector('input').files?.[0], button = panel.querySelector('button');
      const message = text => { (document.querySelector('#b2-personal-import [role=status]') || panel.querySelector('[role=status]')).textContent = text; };
      if (!file) return message('Выбери JSON-файл.');
      if (file.size > 1048576) return message('Максимальный размер файла — 1 МБ.');
      button.disabled = true;
      try {
        const data = JSON.parse(await file.text());
        if (data.format !== 'daily-english-vocabulary-import' || data.version !== 1) throw Error('Неподдерживаемый формат.');
        const result = window.dailyEnglishImportPersonalWords(data.words);
        mount();
        message(`Добавлено ${result.added}; уже были в словаре или повторились: ${result.skipped}.`);
      } catch (error) { message(`Импорт не выполнен: ${error.message}`); }
      finally { button.disabled = false; }
    };
  }
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  mount();
})();
