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

  window.addEventListener('error', event => {
    if (/Social is not defined/i.test(String(event.message || ''))) {
      event.preventDefault();
      window.mlLoadFeatures?.().then(() => window.show?.('Comunidade'));
    }
  });
})();
