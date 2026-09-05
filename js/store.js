window.Store = {
  key: "metalife_state_v7",
  legacyKeys: ["metalife_state", "ml_state"],
  defaults() {
    return { user:null, daily:[], goals:[], weight:[], tasks:[], workouts:[], diet:null, habits:[], checkins:{}, weeklyReviews:[], challenges:[], friends:[], conversations:[] };
  },
  load() {
    const keys = [this.key, ...this.legacyKeys];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const merged = { ...this.defaults(), ...parsed };
        if (key !== this.key) localStorage.setItem(this.key, JSON.stringify(merged));
        return merged;
      } catch (e) { console.warn("Store inválido:", key, e); }
    }
    return this.defaults();
  },
  save(state) {
    try { localStorage.setItem(this.key, JSON.stringify(state)); }
    catch (e) { console.error("Falha ao salvar dados locais", e); }
  },
  reset() {
    localStorage.removeItem(this.key);
  }
};
