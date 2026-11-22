(() => {
  function mount() {
    const form = document.getElementById('b2-vocabulary-form');
    if (!form) return;
    if (!document.getElementById('b2-all-personal-words')) {
      const words = JSON.parse(storageService.getItem('dailyEnglishSystemV2') || '{}').b2Foundation?.vocabulary || [];
      const list = document.createElement('details'); list.id = 'b2-all-personal-words'; list.className = 'b2-extra'; list.open = true;
      const heading = document.createElement('summary'); heading.textContent = `Все мои слова · ${words.length}`; list.append(heading);
      const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Поиск по слову или переводу'; search.setAttribute('aria-label', 'Поиск в личном словаре'); list.append(search);
      const cards = document.createElement('div'); cards.className = 'b2-vocab-list'; list.append(cards);
      function draw() {
        cards.replaceChildren();
        const query = search.value.trim().toLocaleLowerCase();
        words.filter(w => `${w.term} ${w.meaning} ${w.definition || ''}`.toLocaleLowerCase().includes(query)).forEach(word => {
          const card = document.createElement('article'); card.className = 'b2-vocab-card';
          const title = document.createElement('strong'); title.textContent = word.term; card.append(title);
          for (const text of [word.definition, word.meaning, word.nextReview ? `Повторение: ${word.nextReview}` : 'Повторения завершены']) {
            if (!text) continue; const line = document.createElement('div'); line.className = 'b2-vocab-meta'; line.textContent = text; card.append(line);
          }
          const link = document.createElement('a'); link.className = 'sys-btn'; link.textContent = 'Cambridge ↗'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.href = 'https://dictionary.cambridge.org/dictionary/english-russian/' + encodeURIComponent(word.term); card.append(link);
          cards.append(card);
        });
        if (!cards.children.length) cards.textContent = query ? 'Ничего не найдено.' : 'Личный словарь пока пуст.';
      }
      search.oninput = draw; draw(); form.after(list);
    }
    if (document.getElementById('b2-personal-import')) return;
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
        message(`Добавлено ${result.added}; уже были в словаре или повторились: ${result.skipped}. Карточки доступны ниже в «Все мои слова».`);
      } catch (error) { message(`Импорт не выполнен: ${error.message}`); }
      finally { button.disabled = false; }
    };
  }
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  mount();
})();
