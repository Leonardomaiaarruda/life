/* MetaLife 22.2 - leitura unificada do historico de treinos. */
(() => {
  'use strict';
  const arr = value => Array.isArray(value) ? value : [];
  function rows() {
    const merged = new Map();
    const sources = [];
    try { sources.push(...arr(window.MetaLifeV20?.sessions?.())); } catch (_) {}
    try { sources.push(...arr(window.Store?.load?.()?.workouts)); } catch (_) {}
    sources.forEach((item, index) => {
      if (!item) return;
      const date = String(item.date || item.endedAt || item.createdAt || '').slice(0, 10);
      const name = String(item.name || item.title || 'Treino');
      const id = String(item.id || item.sessionId || `${date}|${name}|${index}`);
      const previous = merged.get(id);
      const previousStamp = String(previous?.updatedAt || previous?.endedAt || '');
      const currentStamp = String(item.updatedAt || item.endedAt || '');
      if (!previous || currentStamp >= previousStamp) merged.set(id, {...item, id, date, name});
    });
    return [...merged.values()].sort((a,b) => String(a.endedAt || a.date).localeCompare(String(b.endedAt || b.date)));
  }
  window.MetaLifeWorkoutData = { sessions: rows };
})();
