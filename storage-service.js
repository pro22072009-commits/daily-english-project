(function (global) {
  'use strict';

  const KEYS = ['dailyEnglishProgressV1', 'dailyEnglishAcademicDraftsV2', 'dailyEnglishBandsV1', 'dailyEnglishSystemV2'];
  const META_KEY = 'dailyEnglishStorageMetaV1';
  const BACKUP_KEY = 'dailyEnglishMigrationBackupV1';
  const MIGRATION_KEY = 'dailyEnglishMigrationVersion';
  const SESSION_KEY = 'dailyEnglishCloudSessionV1';
  const QUEUE_KEY = 'dailyEnglishOfflineQueueV1';
  const LAST_SYNC_KEY = 'dailyEnglishLastCloudSyncV1';
  const FRIENDLY = {
    dailyEnglishProgressV1: 'Упражнения, результаты и streak',
    dailyEnglishAcademicDraftsV2: 'Черновики Writing',
    dailyEnglishBandsV1: 'IELTS estimated bands',
    dailyEnglishSystemV2: 'B2 Foundation, календарь и прогресс курса'
  };
  const state = { config: null, session: null, profile: null, status: 'Гостевой режим · данные хранятся на этом устройстве', error: '', conflicts: [], lastSync: '', busy: false, listeners: new Set(), syncTimer: 0, writeTimers: new Map(), migrationWarning: '', migrationBlockedKeys: [] };

  const parse = (value, fallback) => { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const stamp = () => new Date().toISOString();
  const localGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
  state.lastSync = localGet(LAST_SYNC_KEY) || '';
  const emit = () => state.listeners.forEach(fn => { try { fn(api.getState()); } catch (error) { console.warn(error); } });
  function metadata() { return parse(localGet(META_KEY), {}); }
  function writeMetadata(value) { try { localStorage.setItem(META_KEY, JSON.stringify(value)); } catch (error) { state.migrationWarning = 'Не удалось сохранить отметку времени локальных изменений.'; console.warn(error); } }
  function queueOfflineChange(key, payload, updatedAt) {
    const queue = parse(localGet(QUEUE_KEY), {});
    queue[key] = { payload, updatedAt };
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch (error) { state.error = 'Не удалось сохранить очередь синхронизации на устройстве.'; console.warn(error); }
  }
  function setLocal(key, raw, options = {}) {
    if (KEYS.includes(key) && state.migrationBlockedKeys.includes(key) && localGet(key) !== null) {
      state.error = 'Изменение не сохранено: сначала нужна резервная копия старых данных. Освободи место в браузере и обнови страницу.';
      emit();
      return false;
    }
    try { localStorage.setItem(key, raw); } catch (error) { state.error = 'Не удалось сохранить данные на устройстве: возможно, закончилось место.'; emit(); throw error; }
    if (!KEYS.includes(key)) return;
    const meta = metadata();
    if (!options.preserveTimestamp) meta[key] = options.updatedAt || stamp();
    writeMetadata(meta);
    if (options.queue !== false && state.session) queueOfflineChange(key, parse(raw, raw), meta[key]);
    if (options.queue !== false && state.session) scheduleSync();
    else if (!state.session) state.status = navigator.onLine ? 'Сохранено на устройстве' : 'Нет соединения · изменения сохранены на устройстве';
    emit();
  }
  function migrateLocalData() {
    if (localGet(MIGRATION_KEY) === '1') return;
    const backup = {};
    const invalid = [];
    for (const key of KEYS) {
      const raw = localGet(key);
      if (raw === null) continue;
      backup[key] = raw;
      try { JSON.parse(raw); } catch { invalid.push(key); }
    }
    try {
      if (Object.keys(backup).length && !localGet(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, JSON.stringify({ version: 1, createdAt: stamp(), data: backup }));
      localStorage.setItem(MIGRATION_KEY, '1');
      state.migrationWarning = invalid.length ? `Некорректный JSON в ${invalid.map(key => FRIENDLY[key]).join(', ')}. Исходный текст сохранён в резервной копии; повреждённые данные автоматически не заменялись.` : '';
    } catch (error) {
      state.migrationWarning = 'Не удалось создать резервную копию для миграции. Старые данные сохранены без изменений; проверь свободное место браузера.';
      state.migrationBlockedKeys = Object.keys(backup);
      console.warn(error);
    }
  }
  async function loadConfig() {
    const config = global.DAILY_ENGLISH_SUPABASE_CONFIG;
    state.config = config && config.configured && config.url && config.publishableKey ? config : null;
    if (!state.config) state.status = navigator.onLine ? 'Настройка Supabase не найдена. Проверьте конфигурацию GitHub Pages.' : 'Вы офлайн. Данные сохраняются на этом устройстве.';
    emit();
  }
  function authHeaders(token = state.session?.access_token) {
    return { apikey: state.config.publishableKey, Authorization: `Bearer ${token || state.config.publishableKey}`, 'Content-Type': 'application/json' };
  }
  async function authRequest(path, body) {
    if (!state.config) throw new Error('Облачная база не настроена. Данные сохраняются локально.');
    const endpoint = new URL(state.config.url + '/auth/v1/' + path);
    if (path === 'signup') endpoint.searchParams.set('redirect_to', location.origin + location.pathname);
    const response = await fetch(endpoint.toString(), { method: 'POST', headers: authHeaders(null), body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.msg || result.message || result.error_description || result.error || 'Ошибка авторизации.');
    return result;
  }
  async function setSession(session) {
    state.session = session?.access_token ? session : null;
    try { if (state.session) localStorage.setItem(SESSION_KEY, JSON.stringify(state.session)); else localStorage.removeItem(SESSION_KEY); } catch { state.error = 'Сессию не удалось сохранить. Не закрывай страницу до завершения работы.'; }
    emit();
  }
  async function refreshSession() {
    if (!state.session?.refresh_token) return false;
    try { const next = await authRequest('token?grant_type=refresh_token', { refresh_token: state.session.refresh_token }); await setSession(next); return true; } catch { await setSession(null); return false; }
  }
  async function apiFetch(path, init = {}, retried = false) {
    if (!state.config || !state.session) throw new Error('Нет подключённой облачной сессии.');
    const response = await fetch(`${state.config.url}${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } });
    if (response.status === 401 && !retried && await refreshSession()) return apiFetch(path, init, true);
    if (!response.ok) { const error = await response.text(); throw new Error(error || `Ошибка облачной базы (${response.status}).`); }
    return response.status === 204 ? null : response.json().catch(() => null);
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  async function fetchRemote() {
    const rows = await apiFetch('/rest/v1/user_data?select=entity_key,payload,updated_at');
    return new Map((rows || []).map(row => [row.entity_key, row]));
  }
  async function upsert(key, payload, updatedAt) {
    await apiFetch('/rest/v1/user_data?on_conflict=user_id,entity_key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ entity_key: key, payload, updated_at: updatedAt || stamp() }) });
  }
  function setStatus(status, error = '') { state.status = status; state.error = error; emit(); }
  function scheduleSync() {
    clearTimeout(state.syncTimer);
    state.status = navigator.onLine ? 'Синхронизируется' : 'Нет соединения · изменения сохранены на устройстве';
    emit();
    state.syncTimer = setTimeout(() => { if (navigator.onLine) syncWithCloud().catch(error => setStatus('Не удалось синхронизировать', error.message)); }, 800);
  }
  async function syncWithCloud() {
    if (!state.session || !state.config) return { synced: false, reason: 'not-configured' };
    if (!navigator.onLine) { setStatus('Нет соединения · изменения сохранены на устройстве'); return { synced: false, reason: 'offline' }; }
    if (state.busy) return { synced: false, reason: 'busy' };
    state.busy = true; setStatus('Синхронизируется');
    try {
      const remote = await fetchRemote();
      const meta = metadata();
      const conflicts = [];
      const localWrites = [];
      const cloudWrites = [];
      for (const key of KEYS) {
        const localRaw = localGet(key);
        const row = remote.get(key);
        if (localRaw === null && row) { setLocal(key, JSON.stringify(row.payload), { queue: false, preserveTimestamp: true, updatedAt: row.updated_at }); meta[key] = row.updated_at; continue; }
        if (localRaw !== null && !row) { cloudWrites.push([key, parse(localRaw, localRaw), meta[key] || stamp()]); continue; }
        if (localRaw === null || !row) continue;
        const localValue = parse(localRaw, localRaw);
        if (same(localValue, row.payload)) { meta[key] = meta[key] || row.updated_at; continue; }
        const localTime = Date.parse(meta[key] || '');
        const remoteTime = Date.parse(row.updated_at || '');
        if (Number.isFinite(localTime) && Number.isFinite(remoteTime)) {
          if (localTime > remoteTime) cloudWrites.push([key, localValue, meta[key]]);
          else { setLocal(key, JSON.stringify(row.payload), { queue: false, preserveTimestamp: true, updatedAt: row.updated_at }); meta[key] = row.updated_at; }
        } else conflicts.push({ key, localValue, remoteValue: row.payload, updatedAt: row.updated_at });
      }
      writeMetadata(meta);
      state.conflicts = conflicts;
      for (const [key, payload, updatedAt] of cloudWrites) await upsert(key, payload, updatedAt);
      const queue = parse(localGet(QUEUE_KEY), {});
      for (const [key, queued] of Object.entries(queue)) {
        if (conflicts.some(conflict => conflict.key === key)) continue;
        const localNow = parse(localGet(key), null);
        if (!same(localNow, queued.payload)) continue;
        const currentMeta = metadata()[key] || queued.updatedAt;
        const cloudRow = remote.get(key);
        if (!cloudRow || Date.parse(currentMeta || '') >= Date.parse(cloudRow.updated_at || '')) await upsert(key, localNow, currentMeta || stamp());
        delete queue[key];
      }
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      await loadProfile();
      state.lastSync = stamp();
      localStorage.setItem(LAST_SYNC_KEY, state.lastSync);
      setStatus(conflicts.length ? `Нужно разрешить конфликт данных · ${conflicts.length}` : 'Сохранено и синхронизировано');
      return { synced: true, conflicts: conflicts.length };
    } catch (error) { setStatus(navigator.onLine ? 'Не удалось синхронизировать' : 'Нет соединения · изменения сохранены на устройстве', error.message); throw error; }
    finally { state.busy = false; emit(); }
  }
  async function loadProfile() {
    if (!state.session || !state.config) return null;
    const rows = await apiFetch('/rest/v1/profiles?select=id,email,display_name,avatar_url,created_at,updated_at&limit=1');
    state.profile = rows?.[0] || { id: state.session.user?.id, email: state.session.user?.email || '', display_name: state.session.user?.user_metadata?.display_name || '' };
    return state.profile;
  }
  async function saveProfile(patch) {
    const profileId = state.profile?.id || state.session?.user?.id;
    const profile = await apiFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}&select=id,email,display_name,avatar_url,created_at,updated_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...patch, updated_at: stamp() }) });
    if (profile?.[0]) state.profile = profile[0];
    emit();
    return state.profile;
  }
  async function signUp(email, password, displayName) {
    const result = await authRequest('signup', { email, password, data: { display_name: displayName || '' } });
    if (result.access_token) { await setSession(result); await syncWithCloud(); }
    else setStatus('Проверь почту: отправлена ссылка для подтверждения аккаунта');
    return result;
  }
  async function signIn(email, password) { const result = await authRequest('token?grant_type=password', { email, password }); await setSession(result); await syncWithCloud(); return result; }
  async function signOut() { await setSession(null); state.profile = null; state.conflicts = []; setStatus('Гостевой режим · локальные данные сохранены'); }
  function resolveConflict(key, choice) {
    const conflict = state.conflicts.find(item => item.key === key);
    if (!conflict) return;
    const meta = metadata();
    if (choice === 'cloud') {
      setLocal(key, JSON.stringify(conflict.remoteValue), { queue: false, preserveTimestamp: true, updatedAt: conflict.updatedAt });
      meta[key] = conflict.updatedAt;
    } else {
      meta[key] = new Date(Math.max(Date.now(), (Date.parse(conflict.updatedAt || '') || 0) + 1)).toISOString();
      queueOfflineChange(key, conflict.localValue, meta[key]);
    }
    writeMetadata(meta);
    state.conflicts = state.conflicts.filter(item => item.key !== key);
    if (!state.conflicts.length) syncWithCloud().catch(error => setStatus('Ошибка синхронизации', error.message));
    else emit();
  }
  function clearLocalData() { for (const key of KEYS) localStorage.removeItem(key); localStorage.removeItem(META_KEY); localStorage.removeItem(QUEUE_KEY); }
  function getState() { return { configured: Boolean(state.config), session: state.session, profile: state.profile, status: state.status, error: state.error, conflicts: state.conflicts, lastSync: state.lastSync, migrationWarning: state.migrationWarning }; }
  function subscribe(listener) { state.listeners.add(listener); listener(getState()); return () => state.listeners.delete(listener); }
  const api = {
    getItem: localGet,
    setItem: setLocal,
    setItemDebounced(key, raw, delay = 400) { clearTimeout(state.writeTimers.get(key)); state.writeTimers.set(key, setTimeout(() => setLocal(key, raw), delay)); },
    loadProgress() { return localGet('dailyEnglishProgressV1'); },
    saveProgress(value) { setLocal('dailyEnglishProgressV1', JSON.stringify(value)); },
    loadDrafts() { return parse(localGet('dailyEnglishAcademicDraftsV2'), {}); },
    saveDraft(key, value) { const drafts = api.loadDrafts(); drafts[key] = value; api.setItemDebounced('dailyEnglishAcademicDraftsV2', JSON.stringify(drafts)); },
    loadProfile, syncWithCloud, migrateLocalData, clearLocalData, queueOfflineChange, signUp, signIn, signOut, saveProfile, resolveConflict, subscribe, getState,
    setStatus
  };
  global.storageService = api;
  migrateLocalData();
  state.session = parse(localGet(SESSION_KEY), null);
  if (state.session) localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
  loadConfig().then(async () => {
    if (!state.session || !state.config) return;
    if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 60000 && !await refreshSession()) return;
    await syncWithCloud().catch(() => {});
  });
  global.addEventListener('online', () => state.session && syncWithCloud().catch(() => {}));
  global.addEventListener('offline', () => setStatus('Нет соединения · изменения сохраняются на устройстве'));
})(window);
