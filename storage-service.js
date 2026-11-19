(function (global) {
  'use strict';

  const KEYS = ['dailyEnglishProgressV1', 'dailyEnglishAcademicDraftsV2', 'dailyEnglishBandsV1', 'dailyEnglishSystemV2'];
  const META_KEY = 'dailyEnglishStorageMetaV1';
  const BACKUP_KEY = 'dailyEnglishMigrationBackupV1';
  const SAFETY_BACKUPS_KEY = 'dailyEnglishSafetyBackupsV1';
  const BUILD_KEY = 'dailyEnglishAppBuildV1';
  // Bump this value on every published app update. The previous local data is snapshotted before app scripts run.
  const BUILD_VERSION = '2026-11-19.audit1';
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
  const state = { config: null, session: null, profile: null, status: 'Гостевой режим · данные хранятся на этом устройстве', error: '', conflicts: [], lastSync: '', busy: false, startupSyncPending: false, userInteracted: false, initialLocalKeys: [], deferredWrites: new Map(), listeners: new Set(), syncTimer: 0, writeTimers: new Map(), migrationWarning: '', migrationBlockedKeys: [] };

  const parse = (value, fallback) => { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const stamp = () => new Date().toISOString();
  const localGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
  // Apply only this module's edits to the latest saved entity. A second tab
  // can add words, marks or drafts while this module still holds an old copy.
  function mergeChanges(base, edited, latest) {
    if (JSON.stringify(edited) === JSON.stringify(base)) return latest;
    if (JSON.stringify(latest) === JSON.stringify(base) || JSON.stringify(edited) === JSON.stringify(latest)) return edited;
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    if (Array.isArray(edited) && Array.isArray(latest)) {
      const before = Array.isArray(base) ? base : [];
      const key = value => object(value) && value.id != null ? `id:${value.id}` : JSON.stringify(value);
      const b = new Map(before.map(v => [key(v), v]));
      const e = new Map(edited.map(v => [key(v), v]));
      const l = new Map(latest.map(v => [key(v), v]));
      return [...new Set([...l.keys(), ...e.keys()])].flatMap(k => {
        if (b.has(k) && !e.has(k)) return [];
        if (b.has(k) && !l.has(k) && JSON.stringify(e.get(k)) === JSON.stringify(b.get(k))) return [];
        return [e.has(k) ? mergeChanges(b.get(k), e.get(k), l.get(k)) : l.get(k)];
      });
    }
    if (object(edited) && object(latest)) {
      const before = object(base) ? base : {};
      return Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(edited), ...Object.keys(latest)])].flatMap(k => {
        const value = mergeChanges(before[k], edited[k], latest[k]);
        return value === undefined ? [] : [[k, value]];
      }));
    }
    return edited;
  }
  function currentLocalData() { return Object.fromEntries(KEYS.map(key => [key, localGet(key)]).filter(([, value]) => value !== null)); }
  function saveSafetySnapshot(source, data, details = {}) {
    const entry = { version: 1, appBuild: BUILD_VERSION, createdAt: stamp(), source, details, data };
    const existing = parse(localGet(SAFETY_BACKUPS_KEY), []);
    const snapshots = [entry, ...(Array.isArray(existing) ? existing : [])].slice(0, 3);
    try { localStorage.setItem(SAFETY_BACKUPS_KEY, JSON.stringify(snapshots)); state.migrationWarning = ''; return true; }
    catch (error) {
      try { localStorage.setItem(SAFETY_BACKUPS_KEY, JSON.stringify([entry, ...(Array.isArray(existing) ? existing : []).slice(0, 1)])); state.migrationWarning = ''; return true; }
      catch (retryError) { state.migrationWarning = 'Резервная копия не поместилась в хранилище. Прогресс не перезаписан; скачай резервную копию и освободи место.'; console.warn(error, retryError); return false; }
    }
  }
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
    // Re-rendering unchanged data is not a new edit and must not win a cloud conflict.
    if (options.queue !== false && localGet(key) === raw) return true;
    if (KEYS.includes(key) && state.migrationBlockedKeys.includes(key) && localGet(key) !== null) {
      state.error = 'Изменение не сохранено: сначала нужна резервная копия старых данных. Освободи место в браузере и обнови страницу.';
      emit();
      return false;
    }
    // App modules create their empty defaults while the page starts.  Do not let
    // those defaults replace cloud data before the first cloud read finishes.
    const deferStartupWrite = KEYS.includes(key) && state.startupSyncPending && !state.userInteracted && options.queue !== false;
    if (deferStartupWrite) {
      state.deferredWrites.set(key, { raw, options });
      state.status = 'Восстанавливаем сохранённый прогресс…';
      emit();
      return true;
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
  function flushDeferredWrites() {
    if (!state.deferredWrites.size) return;
    const pending = [...state.deferredWrites.entries()];
    state.deferredWrites.clear();
    for (const [key, entry] of pending) setLocal(key, entry.raw, entry.options);
  }
  function discardStartupDefaults() {
    // A failed cloud read cannot authorize replacing saved progress with
    // automatic module defaults. Real user writes have already been saved.
    state.deferredWrites.clear();
    state.startupSyncPending = false;
  }
  function migrateLocalData() {
    const previousBuild = localGet(BUILD_KEY);
    if (previousBuild !== BUILD_VERSION) {
      const existingData = currentLocalData();
      if (Object.keys(existingData).length && !saveSafetySnapshot('before-app-update', existingData, { previousBuild: previousBuild || 'unknown' })) {
        state.migrationBlockedKeys = Object.keys(existingData);
        emit();
        return;
      }
      try { localStorage.setItem(BUILD_KEY, BUILD_VERSION); }
      catch (error) { state.migrationWarning = 'Не удалось записать версию приложения. Старые данные сохранены; обновление прогресса остановлено.'; state.migrationBlockedKeys = Object.keys(existingData); console.warn(error); return; }
    }
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
    if (!state.config) { discardStartupDefaults(); state.status = navigator.onLine ? 'Настройка Supabase не найдена. Проверьте конфигурацию GitHub Pages.' : 'Вы офлайн. Данные сохраняются на этом устройстве.'; }
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
    if (!response.ok) {
      const error = new Error(result.msg || result.message || result.error_description || result.error || 'Ошибка авторизации.');
      error.status = response.status;
      throw error;
    }
    return result;
  }
  async function setSession(session) {
    state.session = session?.access_token ? session : null;
    state.startupSyncPending = Boolean(state.session);
    try { if (state.session) localStorage.setItem(SESSION_KEY, JSON.stringify(state.session)); else localStorage.removeItem(SESSION_KEY); } catch { state.error = 'Сессию не удалось сохранить. Не закрывай страницу до завершения работы.'; }
    emit();
  }
  async function refreshSession() {
    if (!state.session?.refresh_token) return false;
    try {
      if (!navigator.onLine) throw new Error('Нет соединения.');
      const next = await authRequest('token?grant_type=refresh_token', { refresh_token: state.session.refresh_token });
      await setSession(next); return true;
    } catch (error) {
      // Only an explicit invalid-token response ends a session; outages do not.
      if (error.status === 400 || error.status === 401) await setSession(null);
      discardStartupDefaults();
      setStatus(state.session ? 'Не удалось обновить сессию · повтори синхронизацию' : 'Сессия истекла · войди снова', error.message);
      return false;
    }
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
    if (!state.session || !state.config) { discardStartupDefaults(); return { synced: false, reason: 'not-configured' }; }
    if (!navigator.onLine) { discardStartupDefaults(); setStatus('Нет соединения · изменения сохранены на устройстве'); return { synced: false, reason: 'offline' }; }
    if (state.busy) return { synced: false, reason: 'busy' };
    if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 60000 && !await refreshSession()) return { synced: false, reason: 'session-refresh-failed' };
    state.busy = true; let restoredFromCloud = false; setStatus('Синхронизируется');
    try {
      const remote = await fetchRemote();
      const meta = metadata();
      const conflicts = [];
      const localWrites = [];
      const cloudWrites = [];
      for (const key of KEYS) {
        const localRaw = localGet(key);
        const row = remote.get(key);
        if (localRaw === null && row) { state.deferredWrites.delete(key); setLocal(key, JSON.stringify(row.payload), { queue: false, preserveTimestamp: true, updatedAt: row.updated_at }); meta[key] = row.updated_at; restoredFromCloud = true; continue; }
        if (localRaw !== null && row && !state.initialLocalKeys.includes(key)) {
          if (state.userInteracted) {
            conflicts.push({ key, localValue: parse(localRaw, localRaw), remoteValue: row.payload, updatedAt: row.updated_at });
            continue;
          }
          if (saveSafetySnapshot('before-cloud-first-load', { key, side: 'local', value: localRaw, remoteValue: row.payload, updatedAt: row.updated_at }, { entity: key })) {
            state.deferredWrites.delete(key); setLocal(key, JSON.stringify(row.payload), { queue: false, preserveTimestamp: true, updatedAt: row.updated_at });
            meta[key] = row.updated_at;
            restoredFromCloud = true;
            continue;
          }
          conflicts.push({ key, localValue: parse(localRaw, localRaw), remoteValue: row.payload, updatedAt: row.updated_at });
          continue;
        }
        if (localRaw !== null && !row) { cloudWrites.push([key, parse(localRaw, localRaw), meta[key] || stamp()]); continue; }
        if (localRaw === null || !row) continue;
        const localValue = parse(localRaw, localRaw);
        if (same(localValue, row.payload)) { meta[key] = meta[key] || row.updated_at; continue; }
        const localTime = Date.parse(meta[key] || '');
        const remoteTime = Date.parse(row.updated_at || '');
        if (Number.isFinite(localTime) && Number.isFinite(remoteTime)) {
          if (localTime > remoteTime) {
            if (saveSafetySnapshot('before-cloud-overwrite', { key, side: 'cloud', value: row.payload, updatedAt: row.updated_at }, { entity: key })) cloudWrites.push([key, localValue, meta[key]]);
            else conflicts.push({ key, localValue, remoteValue: row.payload, updatedAt: row.updated_at });
          } else if (localTime < remoteTime) {
            if (!saveSafetySnapshot('before-cloud-restore', { key, side: 'local', value: localRaw, updatedAt: meta[key] }, { entity: key })) { conflicts.push({ key, localValue, remoteValue: row.payload, updatedAt: row.updated_at }); continue; }
            state.deferredWrites.delete(key); setLocal(key, JSON.stringify(row.payload), { queue: false, preserveTimestamp: true, updatedAt: row.updated_at }); meta[key] = row.updated_at; restoredFromCloud = true;
          } else conflicts.push({ key, localValue, remoteValue: row.payload, updatedAt: row.updated_at });
        } else conflicts.push({ key, localValue, remoteValue: row.payload, updatedAt: row.updated_at });
      }
      writeMetadata(meta);
      state.conflicts = conflicts;
      for (const conflict of conflicts) state.deferredWrites.delete(conflict.key);
      state.startupSyncPending = false;
      flushDeferredWrites();
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
      state.initialLocalKeys = [...new Set([...state.initialLocalKeys, ...KEYS.filter(key => localGet(key) !== null && !conflicts.some(conflict => conflict.key === key))])];
      return { synced: true, conflicts: conflicts.length };
    } catch (error) { setStatus(navigator.onLine ? 'Не удалось синхронизировать' : 'Нет соединения · изменения сохранены на устройстве', error.message); throw error; }
    finally { state.busy = false; discardStartupDefaults(); emit(); if (restoredFromCloud) global.dispatchEvent(new CustomEvent('dailyEnglishCloudRestored')); }
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
    if (!saveSafetySnapshot('before-manual-conflict-resolution', { key, localValue: conflict.localValue, remoteValue: conflict.remoteValue, updatedAt: conflict.updatedAt }, { entity: key, choice })) { emit(); return; }
    const meta = metadata();
    if (choice === 'cloud') {
      setLocal(key, JSON.stringify(conflict.remoteValue), { queue: false, preserveTimestamp: true, updatedAt: conflict.updatedAt });
      meta[key] = conflict.updatedAt;
    } else {
      meta[key] = new Date(Math.max(Date.now(), (Date.parse(conflict.updatedAt || '') || 0) + 1)).toISOString();
      queueOfflineChange(key, conflict.localValue, meta[key]);
    }
    writeMetadata(meta);
    if (!state.initialLocalKeys.includes(key)) state.initialLocalKeys.push(key);
    state.conflicts = state.conflicts.filter(item => item.key !== key);
    if (!state.conflicts.length) syncWithCloud().catch(error => setStatus('Ошибка синхронизации', error.message));
    else emit();
  }
  function createBackup() {
    return { format: 'daily-english-progress-backup', version: 1, appBuild: BUILD_VERSION, createdAt: stamp(), data: currentLocalData(), recoverySnapshots: parse(localGet(SAFETY_BACKUPS_KEY), []) };
  }
  async function restoreBackup(backup) {
    if (!backup || backup.format !== 'daily-english-progress-backup' || !backup.data || typeof backup.data !== 'object') throw new Error('Это не резервная копия Daily English.');
    const entries = KEYS.filter(key => typeof backup.data[key] === 'string');
    if (!entries.length) throw new Error('В копии не найдены данные прогресса.');
    for (const key of entries) { try { JSON.parse(backup.data[key]); } catch { throw new Error(`В копии повреждён раздел «${FRIENDLY[key]}». Ничего не восстановлено.`); } }
    if (!saveSafetySnapshot('before-manual-restore', currentLocalData(), { backupCreatedAt: backup.createdAt || '' })) throw new Error('Не удалось сохранить текущие данные перед восстановлением. Освободи место и повтори попытку.');
    const meta = metadata();
    for (const key of entries) {
      setLocal(key, backup.data[key], { queue: false });
      meta[key] = stamp();
    }
    writeMetadata(meta);
    if (state.session) {
      for (const key of entries) queueOfflineChange(key, parse(backup.data[key], backup.data[key]), meta[key]);
      scheduleSync();
    }
    return { restored: entries.length };
  }
  function recoveryData(item) {
    if (!item?.data || !String(item.source || '').startsWith('before-')) return null;
    const full = Object.fromEntries(KEYS.filter(key => typeof item.data[key] === 'string').map(key => [key, item.data[key]]));
    if (Object.keys(full).length) return full;
    // Sync safety copies hold a single entity, unlike full update backups.
    const { key } = item.data;
    if (!KEYS.includes(key)) return null;
    const value = Object.prototype.hasOwnProperty.call(item.data, 'localValue') ? item.data.localValue : item.data.value;
    if (value === undefined) return null;
    return { [key]: typeof value === 'string' ? value : JSON.stringify(value) };
  }
  function getRecoveryBackups() {
    const snapshots = parse(localGet(SAFETY_BACKUPS_KEY), []);
    return (Array.isArray(snapshots) ? snapshots : []).map((item, index) => ({ item, index })).filter(({ item }) => recoveryData(item)).map(({ item, index }) => ({ index, createdAt: item.createdAt, previousBuild: item.source === 'before-manual-restore' ? 'восстановления' : item.source.startsWith('before-cloud-') ? 'синхронизации' : item.source === 'before-manual-conflict-resolution' ? 'разрешения конфликта' : item.details?.previousBuild || 'предыдущей версии' }));
  }
  async function restoreRecoveryBackup(index) {
    const snapshots = parse(localGet(SAFETY_BACKUPS_KEY), []);
    const item = Array.isArray(snapshots) ? snapshots[Number(index)] : null;
    const data = recoveryData(item);
    if (!data) throw new Error('Автоматическая копия не найдена.');
    return restoreBackup({ format: 'daily-english-progress-backup', version: 1, createdAt: item.createdAt, data });
  }
  function clearLocalData() { for (const key of KEYS) localStorage.removeItem(key); localStorage.removeItem(META_KEY); localStorage.removeItem(QUEUE_KEY); }
  function getState() { return { configured: Boolean(state.config), session: state.session, profile: state.profile, status: state.status, error: state.error, conflicts: state.conflicts, lastSync: state.lastSync, migrationWarning: state.migrationWarning }; }
  function subscribe(listener) { state.listeners.add(listener); listener(getState()); return () => state.listeners.delete(listener); }
  const api = {
    getItem: localGet,
    mergeChanges,
    setItem: setLocal,
    // Persist immediately so refresh/close cannot discard the last keystrokes.
    // scheduleSync already debounces network writes independently.
    setItemDebounced(key, raw, delay = 400) { setLocal(key, raw); },
    loadProgress() { return localGet('dailyEnglishProgressV1'); },
    saveProgress(value) { setLocal('dailyEnglishProgressV1', JSON.stringify(value)); },
    loadDrafts() { return parse(localGet('dailyEnglishAcademicDraftsV2'), {}); },
    saveDraft(key, value) { const drafts = api.loadDrafts(); drafts[key] = value; api.setItemDebounced('dailyEnglishAcademicDraftsV2', JSON.stringify(drafts)); },
    loadProfile, syncWithCloud, migrateLocalData, clearLocalData, queueOfflineChange, signUp, signIn, signOut, saveProfile, resolveConflict, createBackup, restoreBackup, getRecoveryBackups, restoreRecoveryBackup, subscribe, getState,
    setStatus
  };
  global.storageService = api;
  migrateLocalData();
  state.initialLocalKeys = KEYS.filter(key => localGet(key) !== null);
  state.session = parse(localGet(SESSION_KEY), null);
  state.startupSyncPending = Boolean(state.session);
  for (const eventName of ['pointerdown', 'keydown', 'input', 'change', 'submit']) global.addEventListener(eventName, () => { state.userInteracted = true; }, { capture: true, once: true });
  if (state.session) localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
  loadConfig().then(async () => {
    if (!state.session || !state.config) return;
    if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 60000 && !await refreshSession()) return;
    await syncWithCloud().catch(() => {});
  });
  global.addEventListener('online', () => state.session && syncWithCloud().catch(() => {}));
  global.addEventListener('offline', () => setStatus('Нет соединения · изменения сохраняются на устройстве'));
})(window);
