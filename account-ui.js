(function () {
  'use strict';
  const service = window.storageService;
  if (!service) return;
  const el = id => document.getElementById(id);
  const mobileLayout = () => window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const parse = key => { try { return JSON.parse(service.getItem(key) || '{}'); } catch { return {}; } };
  const labels = { dailyEnglishProgressV1: 'Упражнения, результаты и streak', dailyEnglishAcademicDraftsV2: 'Черновики Writing', dailyEnglishBandsV1: 'IELTS estimated bands', dailyEnglishSystemV2: 'B2 Foundation и календарь' };
  function backupControls() {
    const snapshots = service.getRecoveryBackups();
    const recovery = snapshots.length ? `<details class="account-conflicts"><summary>Автоматические копии прошлых версий · ${snapshots.length}</summary>${snapshots.map(item => `<article><strong>${safe(new Date(item.createdAt).toLocaleString('ru-RU'))} · до ${safe(item.previousBuild)}</strong><div><button type="button" class="account-small" data-restore-safety-backup="${item.index}">Восстановить эту версию</button></div></article>`).join('')}</details>` : '';
    return `<section class="account-note"><strong>Резервная копия всего прогресса</strong><p>Сохраняет упражнения, календарь, огонёк, слова, IELTS и черновики в файл на устройстве.</p><div class="account-actions"><button class="account-secondary" id="downloadProgressBackup" type="button">Скачать копию</button><button class="account-secondary" id="chooseProgressBackup" type="button">Восстановить копию</button><input id="progressBackupFile" type="file" accept="application/json,.json" hidden></div>${recovery}</section>`;
  }
  const headerMeta = document.querySelector('.topbar .meta');
  document.querySelector('.app')?.insertAdjacentHTML('afterbegin', '<div class="global-storage-status" id="storageStatus" role="status" aria-live="polite"></div>');
  headerMeta?.insertAdjacentHTML('beforeend', '<button class="account-trigger" id="accountButton" type="button" aria-label="Открыть профиль и настройки аккаунта">Войти</button>');
  document.body.insertAdjacentHTML('beforeend', `<div class="account-backdrop" id="accountBackdrop" hidden><section class="account-dialog" role="dialog" aria-modal="true" aria-labelledby="accountTitle" tabindex="-1"><div class="account-head"><div><span class="account-kicker">АККАУНТ И ДАННЫЕ</span><h2 id="accountTitle">Профиль</h2></div><button class="account-close" id="accountClose" type="button" aria-label="Закрыть окно профиля">×</button></div><p class="account-status" id="accountStatus" role="status" aria-live="polite"></p><div id="accountContent"></div></section></div>`);
  const backdrop = el('accountBackdrop');
  const modal = backdrop.querySelector('.account-dialog');
  const status = el('accountStatus');
  const content = el('accountContent');
  let installPrompt = null;
  function stats() {
    const progress = parse('dailyEnglishProgressV1');
    const bands = parse('dailyEnglishBandsV1');
    const system = parse('dailyEnglishSystemV2');
    const values = ['Listening', 'Reading', 'Writing', 'Speaking'].map(name => Number(bands[name] || 4)).filter(Number.isFinite);
    const overall = values.length ? (Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 2) / 2).toFixed(1) : '—';
    const start = 4;
    const progressPercent = overall === '—' ? '—' : `${Math.max(0, Math.min(100, Math.round((Number(overall) - start) / Math.max(0.5, 6.5 - start) * 100)))}%`;
    return { overall, skillBands: Object.fromEntries(['Listening', 'Reading', 'Writing', 'Speaking'].map(name => [name, Number(bands[name] || 4).toFixed(1)])), progressPercent, streak: Math.max(Number(progress.stats?.streak) || 0, Number(system.stats?.streak) || 0), exercises: Math.max(Number(progress.stats?.completedExercises) || 0, Number(system.stats?.completedExercises) || 0), mode: system.studyMode === 'ielts' ? 'IELTS Academic' : 'B2 Foundation' };
  }
  function render() {
    const state = service.getState();
    const user = state.session?.user;
    const s = stats();
    const syncing = state.status === 'Синхронизируется' && mobileLayout();
    const trigger = el('accountButton');
    if (trigger) trigger.textContent = user ? 'Мой профиль' : 'Войти';
    status.textContent = [state.status, state.error, state.migrationWarning].filter(Boolean).join(' · ');
    if (mobileLayout() && syncing) status.setAttribute('aria-busy', 'true');
    else status.removeAttribute('aria-busy');
    const globalStatus = el('storageStatus');
    if (globalStatus) globalStatus.textContent = [state.status, state.error, state.migrationWarning].filter(Boolean).join(' · ');
    const cloudNotice = state.configured ? '' : '<p class="account-note">Облачная база пока не настроена. Сайт работает в гостевом режиме; прогресс остаётся на этом устройстве.</p>';
    const conflictMarkup = state.conflicts.length ? `<section class="account-conflicts"><h3>Нужно выбрать версию данных</h3><p>Локальная запись и облачная запись отличаются, а надёжной даты одной из них нет. Выбери вручную; резервная копия локальных данных сохранена.</p>${state.conflicts.map(item => `<article><strong>${safe(labels[item.key] || item.key)}</strong><div><button type="button" class="account-small" data-conflict="${safe(item.key)}" data-choice="local">Оставить на этом устройстве</button><button type="button" class="account-small" data-conflict="${safe(item.key)}" data-choice="cloud">Взять из облака</button></div></article>`).join('')}</section>` : '';
    if (!user) {
      content.innerHTML = `${cloudNotice}${backupControls()}<form id="accountForm" class="account-form"><label>Имя (для регистрации)<input name="displayName" autocomplete="name" maxlength="80" placeholder="Как к тебе обращаться"></label><label>Email<input name="email" type="email" required autocomplete="email" inputmode="email"></label><label>Пароль<input name="password" type="password" required minlength="8" autocomplete="current-password"></label><div class="account-actions"><button class="account-primary" type="submit" data-auth="signin" ${state.configured ? '' : 'disabled'}>Войти</button><button class="account-secondary" type="submit" data-auth="signup" ${state.configured ? '' : 'disabled'}>Создать аккаунт</button></div></form><p class="account-note">При регистрации с подтверждением по почте данные синхронизируются после перехода по ссылке. Пароль сайт не сохраняет.</p>${conflictMarkup}`;
    } else {
      content.innerHTML = `<div class="account-identity">${state.profile?.avatar_url ? `<img src="${safe(state.profile.avatar_url)}" alt="">` : '<span aria-hidden="true">👤</span>'}<div><strong>${safe(state.profile?.display_name || user.user_metadata?.display_name || 'Мой профиль')}</strong><small>${safe(state.profile?.email || user.email)}</small></div></div><div class="account-metrics"><div><small>Режим</small><strong>${safe(s.mode)}</strong></div><div><small>Estimated overall</small><strong>${safe(s.overall)} / 9.0</strong></div><div><small>Цель и прогресс</small><strong>6.5 · ${safe(s.progressPercent)}</strong></div><div><small>Listening</small><strong>${safe(s.skillBands.Listening)}</strong></div><div><small>Reading</small><strong>${safe(s.skillBands.Reading)}</strong></div><div><small>Writing</small><strong>${safe(s.skillBands.Writing)}</strong></div><div><small>Speaking</small><strong>${safe(s.skillBands.Speaking)}</strong></div><div><small>Streak</small><strong>${safe(s.streak)} дней</strong></div><div><small>Упражнения</small><strong>${safe(s.exercises)}</strong></div><div><small>Синхронизация</small><strong>${state.lastSync ? safe(new Date(state.lastSync).toLocaleString('ru-RU')) : 'пока не выполнялась'}</strong></div></div>${backupControls()}<div class="account-actions"><button class="account-primary" id="syncNow" type="button" ${syncing ? 'aria-busy="true" disabled' : ''}>Синхронизировать</button><button class="account-secondary" id="signOut" type="button">Выйти</button></div>${installPrompt ? '<button class="account-secondary account-install" id="installApp" type="button">Установить приложение</button>' : ''}${conflictMarkup}`;
    }
  }
  function show() { backdrop.hidden = false; document.body.classList.add('account-open'); render(); modal.focus(); }
  function hide() { backdrop.hidden = true; document.body.classList.remove('account-open'); el('accountButton')?.focus(); }
  el('accountButton').addEventListener('click', show);
  el('accountClose').addEventListener('click', hide);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) hide(); });
  document.addEventListener('keydown', event => { if (!backdrop.hidden && event.key === 'Escape') hide(); });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(item => item.offsetParent !== null);
    if (!items.length) return;
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
  });
  content.addEventListener('submit', async event => {
    if (event.target.id !== 'accountForm') return;
    event.preventDefault();
    const form = new FormData(event.target);
    const button = event.submitter;
    status.textContent = button?.dataset.auth === 'signup' ? 'Создаю аккаунт…' : 'Выполняю вход…';
    if (mobileLayout()) {
      status.setAttribute('aria-busy', 'true');
      if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    }
    try {
      const method = button?.dataset.auth === 'signup' ? 'signUp' : 'signIn';
      await service[method](String(form.get('email')).trim(), String(form.get('password')), String(form.get('displayName') || '').trim());
    } catch (error) { service.setStatus('Не удалось выполнить запрос', error.message); }
  });
  content.addEventListener('click', async event => {
    const recovery = event.target.closest('[data-restore-safety-backup]');
    if (recovery) {
      if (!global.confirm('Текущие данные будут сохранены в автоматическую копию, затем заменены выбранной версией. Продолжить?')) return;
      try { await service.restoreRecoveryBackup(recovery.dataset.restoreSafetyBackup); global.location.reload(); }
      catch (error) { status.textContent = error.message || 'Не удалось восстановить автоматическую копию.'; }
      return;
    }
    if (event.target.id === 'downloadProgressBackup') {
      const backup = service.createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `daily-english-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Резервная копия скачана. Сохрани файл отдельно от сайта.';
      return;
    }
    if (event.target.id === 'chooseProgressBackup') { el('progressBackupFile')?.click(); return; }

    const conflict = event.target.closest('[data-conflict]');
    if (conflict) { service.resolveConflict(conflict.dataset.conflict, conflict.dataset.choice); return; }
    if (event.target.id === 'syncNow') { try { await service.syncWithCloud(); } catch {} }
    if (event.target.id === 'signOut') await service.signOut();
    if (event.target.id === 'installApp' && installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; render(); }
  });
  content.addEventListener('change', async event => {
    if (event.target.id !== 'progressBackupFile' || !event.target.files?.[0]) return;
    const file = event.target.files[0];
    try {
      const backup = JSON.parse(await file.text());
      if (!global.confirm('Текущие данные будут сохранены в автоматическую копию, затем заменены данными из выбранного файла. Продолжить?')) return;
      status.textContent = 'Сохраняю текущий прогресс и восстанавливаю копию…';
      await service.restoreBackup(backup);
      status.textContent = 'Копия восстановлена. Перезагружаю сайт…';
      setTimeout(() => global.location.reload(), 250);
    } catch (error) { status.textContent = error.message || 'Не удалось восстановить резервную копию.'; }
    finally { event.target.value = ''; }
  });
  service.subscribe(render);
  global.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; render(); });
  global.addEventListener('appinstalled', () => { installPrompt = null; render(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register(new URL('./sw.js', location.href)).catch(error => console.warn('PWA registration failed', error));
})();