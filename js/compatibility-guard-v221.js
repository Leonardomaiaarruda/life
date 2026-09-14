/* MetaLife V22.1.1 — guard de compatibilidade e estabilidade. */
(() => {
  'use strict';
  if (window.__mlCompatGuardV221) return;
  window.__mlCompatGuardV221 = true;

  const NativeObserver = window.MutationObserver;
  if (typeof NativeObserver === 'function' && !window.__mlCompatObserverV221) {
    class CompatObserver extends NativeObserver {
      constructor(callback) {
        super((records, observer) => {
          const useful = records.filter(record => {
            const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
            if (!target) return true;
            if (target.closest?.('#v14Tools')) return false;
            if (target.closest?.('#v20Stage2Progress')) return false;
            return true;
          });
          if (useful.length) callback(useful, observer);
        });
      }
    }
    window.MutationObserver = CompatObserver;
    window.__mlCompatObserverV221 = true;
  }

  /* app.js já definiu boot antes deste arquivo. Envolvemos imediatamente, ainda
     antes do DOMContentLoaded, para validar token persistido no auto-login. */
  if (typeof window.boot === 'function' && !window.boot.__mlCompatSessionV221) {
    const originalBoot = window.boot;
    const safeBoot = async function(...args) {
      const token = localStorage.getItem('ml_token');
      const loginBusy = document.getElementById('loginForm')?.dataset.loading === 'true';
      if (token && !loginBusy && navigator.onLine !== false && window.CONFIG?.API_URL) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        try {
          const response = await fetch(window.CONFIG.API_URL, {
            method: 'POST',
            headers: {'Content-Type':'text/plain;charset=utf-8'},
            body: JSON.stringify({action:'sessionStatus', token}),
            signal: controller.signal
          });
          if (response.ok) {
            const result = await response.json().catch(() => null);
            const text = String(result?.error || result?.message || '');
            if (result?.ok === false && /sess[aã]o|sessao|token|expirad|inv[aá]lid|login/i.test(text)) {
              localStorage.removeItem('ml_token');
              localStorage.removeItem('ml_user_id');
              document.getElementById('authScreen')?.classList.remove('hidden');
              document.getElementById('app')?.classList.add('hidden');
              return;
            }
          }
        } catch (_) {
          /* Sem resposta: preserva a sessão local e deixa o app abrir. */
        } finally {
          clearTimeout(timer);
        }
      }
      return originalBoot.apply(this, args);
    };
    safeBoot.__mlCompatSessionV221 = true;
    window.boot = safeBoot;
  }

  /* Evita corrida ao tocar em módulos que ainda estão sendo carregados. */
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-nav-page]');
    const page = button?.dataset?.navPage;
    if (!button || !['Comunidade','Desafios'].includes(page)) return;
    const ready = page === 'Comunidade' ? !!window.Social : !!window.MetaLifeChallengesV22;
    if (ready) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    Promise.resolve(window.mlLoadFeatures?.()).then(() => {
      if (page === 'Desafios' && window.MetaLifeChallengesV22?.render) window.MetaLifeChallengesV22.render();
      else window.show?.(page);
    });
  }, true);
})();
