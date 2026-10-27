(function () {
  'use strict';
  const service = window.storageService;
  if (!service) return;
  const el = id => document.getElementById(id);
  const mobileLayout = () => window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const parse = key => { try { return JSON.parse(service.getItem(key) || '{}'); } catch { return {}; } };
  const labels = { dailyEnglishProgressV1: 'Упражнения, результаты и streak', dailyEnglishAcademicDraftsV2: 'Черновики Writing', dailyEnglishBandsV1: 'IELTS estimated bands', dailyEnglishSystemV2: 'B2 Foundation и календарь' };
  const headerMeta = document.querySelector('.topbar .meta');
  document.querySelector('.app')?.insertAdjacentHTML('afterbegin', '<div class="global-storage-status" id="storageStatus" role="status" aria-live="polite"></div>');
  headerMeta?.insertAdjacentHTML('beforeend', '<button class="account-trigger" id="accountButton" type="button" aria-label="Открыть профиль и настройки аккаунта">Войти</button>');
  document.body.insertAdjacentHTML('beforeend', `<div class="account-backdrop" id="accountBackdrop" hidden><section class="account-dialog" role="dialog" aria-modal="true" aria-labelledby="accountTitle" tabindex="-1"><div class="account-head"><div><span class="account-kicker">АККАУНТ И ДАННЫЕ</span><h2 id="accountTitle">Профиль</h2></div><button class="account-close" id="accountClose" type="button" aria-label="Закрыть окно профиля">×</button></div><p class="account-status" id="accountStatus" role="status" aria-live="polite"></p><div id="accountContent"></div></section></div>`);
  const backdrop = el('accountBackdrop');
  const modal = backdrop.querySelector('.account-dialog');
  const status = el('accountStatus');
  const content = el('accountContent');
  let deleteMode = false;
  let installPrompt = null;
  function stats() {
    const progress = parse('dailyEnglishProgressV1');
    const bands = parse('dailyEnglishBandsV1');
    const system = parse('dailyEnglishSystemV2');
    const values = ['Listening', 'Reading', 'Writing', 'Speaking'].map(name => Number(bands[name] || 4)).filter(Number.isFinite);
    const overall = values.length ? (Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 2) / 2).toFixed(1) : '—';
    const start = 4;
    const progressPercent = overall === '—' ? '—' : `${Math.max(0, Math.min(100, Math.round((Number(overall) - start) / Math.max(0.5, 6.5 - start) * 100)))}%`;
    return { overall, skillBands: Object.fromEntries(['Listening', 'Reading', 'Writing', 'Speaking'].map(name => [name, Number(bands[name] || 4).toFixed(1)])), progressPercent, streak: progress.stats?.streak ?? system.stats?.streak ?? 0, exercises: progress.stats?.completedExercises ?? system.stats?.completedExercises ?? 0, mode: system.studyMode === 'ielts' ? 'IELTS Academic' : 'B2 Foundation' };
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
      content.innerHTML = `${cloudNotice}<form id="accountForm" class="account-form"><label>Имя (для регистрации)<input name="displayName" autocomplete="name" maxlength="80" placeholder="Как к тебе обращаться"></label><label>Email<input name="email" type="email" required autocomplete="email" inputmode="email"></label><label>Пароль<input name="password" type="password" required minlength="8" autocomplete="current-password"></label><div class="account-actions"><button class="account-primary" type="submit" data-auth="signin" ${state.configured ? '' : 'disabled'}>Войти</button><button class="account-secondary" type="submit" data-auth="signup" ${state.configured ? '' : 'disabled'}>Создать аккаунт</button></div></form><p class="account-note">При регистрации с подтверждением по почте данные синхронизируются после перехода по ссылке. Пароль сайт не сохраняет.</p>${conflictMarkup}`;
    } else {
      content.innerHTML = `<div class="account-identity">${state.profile?.avatar_url ? `<img src="${safe(state.profile.avatar_url)}" alt="">` : '<span aria-hidden="true">👤</span>'}<div><strong>${safe(state.profile?.display_name || user.user_metadata?.display_name || 'Мой профиль')}</strong><small>${safe(state.profile?.email || user.email)}</small></div></div><div class="account-metrics"><div><small>Режим</small><strong>${safe(s.mode)}</strong></div><div><small>Estimated overall</small><strong>${safe(s.overall)} / 9.0</strong></div><div><small>Цель и прогресс</small><strong>6.5 · ${safe(s.progressPercent)}</strong></div><div><small>Listening</small><strong>${safe(s.skillBands.Listening)}</strong></div><div><small>Reading</small><strong>${safe(s.skillBands.Reading)}</strong></div><div><small>Writing</small><strong>${safe(s.skillBands.Writing)}</strong></div><div><small>Speaking</small><strong>${safe(s.skillBands.Speaking)}</strong></div><div><small>Streak</small><strong>${safe(s.streak)} дней</strong></div><div><small>Упражнения</small><strong>${safe(s.exercises)}</strong></div><div><small>Синхронизация</small><strong>${state.lastSync ? safe(new Date(state.lastSync).toLocaleString('ru-RU')) : 'пока не выполнялась'}</strong></div></div><div class="account-actions"><button class="account-primary" id="syncNow" type="button" ${syncing ? 'aria-busy="true" disabled' : ''}>Синхронизировать</button><button class="account-secondary" id="signOut" type="button">Выйти</button></div>${installPrompt ? '<button class="account-secondary account-install" id="installApp" type="button">Установить приложение</button>' : ''}${conflictMarkup}<details class="account-delete"><summary>Удалить аккаунт</summary><p>Аккаунт и облачные данные будут удалены. Локальная копия останется на этом устройстве как гостевые данные.</p>${deleteMode ? '<label>Для подтверждения введи УДАЛИТЬ<input id="deleteConfirm" autocomplete="off"></label><button class="account-danger" id="deleteAccount" type="button">Удалить аккаунт и облачные данные</button>' : '<button class="account-danger" id="prepareDelete" type="button">Начать удаление аккаунта</button>'}</details>`;
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
    if (event.target.id === 'prepareDelete' || event.target.id === 'deleteAccount') return;
    const conflict = event.target.closest('[data-conflict]');
    if (conflict) { service.resolveConflict(conflict.dataset.conflict, conflict.dataset.choice); return; }
    if (event.target.id === 'syncNow') { try { await service.syncWithCloud(); } catch {} }
    if (event.target.id === 'signOut') await service.signOut();
    if (event.target.id === 'prepareDelete') { deleteMode = true; render(); el('deleteConfirm')?.focus(); }
    if (event.target.id === 'deleteAccount') {
      if (el('deleteConfirm')?.value !== 'УДАЛИТЬ') { status.textContent = 'Введи слово УДАЛИТЬ, чтобы подтвердить действие.'; return; }
      if (!globalThis.confirm('Удалить аккаунт и облачные данные без возможности восстановления? Локальные данные останутся на устройстве.')) return;
      status.textContent = 'Удаляю аккаунт…';
      if (mobileLayout()) {
        status.setAttribute('aria-busy', 'true');
        event.target.setAttribute('aria-busy', 'true');
      }
      try { await service.deleteAccount(); deleteMode = false; } catch (error) { service.setStatus('Не удалось удалить аккаунт', error.message); }
    }
    if (event.target.id === 'installApp' && installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; render(); }
  });
  service.subscribe(render);
  global.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; render(); });
  global.addEventListener('appinstalled', () => { installPrompt = null; render(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register(new URL('./sw.js', location.href)).catch(error => console.warn('PWA registration failed', error));
})();
