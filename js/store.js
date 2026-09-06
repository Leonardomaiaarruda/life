window.Store = {
  get key() {
    const owner = localStorage.getItem('ml_user_id');
    return localStorage.getItem('ml_token') && owner
      ? 'metalife_account_' + encodeURIComponent(owner)
      : 'metalife_demo_v1';
  },
  defaults() {
    return { user:null, daily:[], goals:[], weight:[], tasks:[], workouts:[], diet:null, habits:[], checkins:{}, weeklyReviews:[], challenges:[], friends:[], conversations:[] };
  },
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) return { ...this.defaults(), ...JSON.parse(raw) };
      const owner = localStorage.getItem('ml_user_id');
      if (owner && localStorage.getItem('ml_token')) {
        for (const key of ['metalife_state_v7', 'metalife_state', 'ml_state']) {
          const old = JSON.parse(localStorage.getItem(key) || 'null');
          if (old && String(old.user?.user_id || old.user?.id || '') === owner) {
            const migrated = { ...this.defaults(), ...old };
            this.save(migrated);
            return migrated;
          }
        }
      }
    } catch (error) { console.error('Falha ao carregar dados locais', error); }
    return this.defaults();
  },
  save(state) {
    try { localStorage.setItem(this.key, JSON.stringify(state)); }
    catch (error) {
      console.error('Falha ao salvar dados locais', error);
      if (typeof toast === 'function') toast('Não foi possível salvar neste navegador. Verifique o espaço disponível.');
    }
  },
  reset() { localStorage.removeItem(this.key); }
};
