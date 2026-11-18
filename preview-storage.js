// Isolated redesign sandbox: no persistent storage, login, or network writes.
(function () {
  const values = new Map();
  const state = { configured: false, session: null, profile: null, status: 'Предпросмотр редизайна · тестовые данные только в памяти', error: '', conflicts: [], lastSync: '' };
  window.storageService = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); return true; },
    setItemDebounced: (key, value) => { values.set(key, String(value)); },
    getState: () => ({ ...state }),
    subscribe: fn => { fn({ ...state }); return () => {}; },
    syncWithCloud: async () => ({ synced: false, reason: 'isolated-preview' }),
    getRecoveryBackups: () => [],
    createBackup: () => ({ format: 'daily-english-preview-only', data: Object.fromEntries(values) })
  };
  document.addEventListener('DOMContentLoaded', () => {
    const notice = document.createElement('div');
    notice.textContent = 'ПРЕДПРОСМОТР РЕДИЗАЙНА · Изменения здесь исчезнут после перезагрузки. Рабочий прогресс не подключён.';
    notice.style.cssText = 'padding:12px;text-align:center;background:#26334c;color:#e8efff;font:14px system-ui;';
    document.body.prepend(notice);
  });
})();
