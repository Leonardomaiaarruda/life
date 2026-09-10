/* MetaLife — carregamento rápido/offline-first para Apps Script + Google Sheets. */
(() => {
  if (!window.API || !window.Store) return;

  const SERVER_CACHE_TTL = 20000;
  const refreshes = new Map();
  const originalCall = window.API.call.bind(window.API);
  let applyTimer = 0;
  let applyingFreshData = false;

  const owner = () => String(localStorage.getItem('ml_user_id') || 'demo');
  const arr = value => Array.isArray(value) ? value : [];
  const cacheKey = (action, data) => `ml_fast_api_v1:${owner()}:${action}:${JSON.stringify(data || {})}`;

  function readCache(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function writeCache(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), value })); }
    catch { /* cache is optional */ }
  }

  function localDashboard() {
    const s = Store.load();
    const items = value => ({ ok: true, items: arr(value) });
    const checkins = Array.isArray(s.checkins) ? s.checkins : Object.values(s.checkins || {});
    const diet = s.diet ? [s.diet] : [];
    const progress = s.unifiedProgress?.owner === owner() ? { ok: true, ...s.unifiedProgress } : undefined;

    return {
      ok: true,
      localSnapshot: true,
      sections: {
        listDaily: items(s.daily),
        listGoals: items(s.goals),
        listWeight: items(s.weight),
        listTasks: items(s.tasks),
        listWorkouts: items(s.workouts),
        listDiet: items(diet),
        listHabits: items(s.habits),
        listCheckins: items(checkins),
        listWeeklyReviews: items(s.weeklyReviews)
      },
      progress
    };
  }

  function localValue(action) {
    const s = Store.load();
    if (action === 'getDashboard') return localDashboard();
    if (action === 'listChallengesV7') return { ok: true, items: arr(s.challenges), localSnapshot: true };
    if (action === 'getUnifiedProgress' && s.unifiedProgress?.owner === owner()) {
      return { ok: true, ...s.unifiedProgress, localSnapshot: true };
    }
    return null;
  }

  function rerenderCurrentPage() {
    const page = document.getElementById('pageTitle')?.textContent?.trim();
    if (!page || page === 'Chats') return;
    if (page === 'Evolução') window.MetaLifeV13?.render?.();
    else window.show?.(page);
  }

  function scheduleApplyFreshData() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(async () => {
      if (applyingFreshData || document.hidden || !localStorage.getItem('ml_token')) return;
      if (window.Sync?.hasPending?.()) return;
      if (typeof window.syncFromServer !== 'function') {
        scheduleApplyFreshData();
        return;
      }

      applyingFreshData = true;
      try {
        await window.syncFromServer();
        window.renderUserBadge?.();
        rerenderCurrentPage();
        window.UnifiedXP?.paint?.();
      } catch (error) {
        console.warn('MetaLife: atualização em segundo plano falhou.', error);
      } finally {
        applyingFreshData = false;
      }
    }, 180);
  }

  function refreshInBackground(action, data, key) {
    if (refreshes.has(key) || navigator.onLine === false || !localStorage.getItem('ml_token')) return;
    const request = originalCall(action, data)
      .then(result => {
        if (result?.ok) {
          writeCache(key, result);
          scheduleApplyFreshData();
        }
        return result;
      })
      .catch(error => {
        console.warn(`MetaLife: ${action} não pôde ser atualizado em segundo plano.`, error);
      })
      .finally(() => refreshes.delete(key));
    refreshes.set(key, request);
  }

  window.API.call = async function fastCall(action, data = {}) {
    const fastRead = action === 'getDashboard' || action === 'listChallengesV7' || action === 'getUnifiedProgress';
    if (!fastRead || !localStorage.getItem('ml_token')) return originalCall(action, data);

    const key = cacheKey(action, data);
    const cached = readCache(key);
    if (cached && Date.now() - Number(cached.at || 0) < SERVER_CACHE_TTL && cached.value?.ok) {
      return cached.value;
    }

    const local = localValue(action);
    if (local) {
      refreshInBackground(action, data, key);
      return local;
    }

    const result = await originalCall(action, data);
    if (result?.ok) writeCache(key, result);
    return result;
  };

  /* O boot não deve esperar alterações antigas terminarem de subir. */
  if (window.Sync?.flush) {
    const realFlush = window.Sync.flush.bind(window.Sync);
    window.Sync.flushNow = realFlush;
    window.Sync.flush = async function backgroundFlush(retryBlocked = true) {
      realFlush(retryBlocked).catch(() => {});
      return undefined;
    };
  }

  window.addEventListener('metalife-data-saved', scheduleApplyFreshData);
  window.addEventListener('online', scheduleApplyFreshData);
})();
