/* MetaLife V22 — carrega módulos pesados somente depois que o painel já abriu. */
(() => {
  'use strict';

  let started = false;
  let finished = false;
  const loadedScripts = new Map();

  const VERSION = '20260911-v22-challenges1';
  const featureScripts = [
    'js/social.js',
    'js/competitions.js',
    'js/community.js',
    'js/health-import.js',
    'js/progress.js',
    'js/v13.js',
    'js/mobile-nav.js',
    'js/v14.js',
    'js/v15.js',
    'js/v16.js',
    'js/v17.js',
    'js/v18.js',
    'js/v19.js',
    'js/v20.js',
    'js/v20-library-complete.js',
    'js/v20-stage2.js',
    'js/v20-stage3.js',
    'js/v21-history-guidance.js',
    'js/challenges-v22.js'
  ];

  function script(src, external = false) {
    const key = src;
    if (loadedScripts.has(key)) return loadedScripts.get(key);
    const promise = new Promise((resolve, reject) => {
      if ([...document.scripts].some(node => node.src && node.src.includes(src))) {
        resolve();
        return;
      }
      const node = document.createElement('script');
      node.src = external ? src : `${src}?v=${VERSION}`;
      node.async = false;
      node.dataset.mlLazy = '1';
      node.onload = () => resolve();
      node.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
      document.body.appendChild(node);
    });
    loadedScripts.set(key, promise);
    return promise;
  }

  async function loadFeatures() {
    if (started) return window.mlFeaturesReady;
    started = true;

    window.mlFeaturesReady = (async () => {
      try {
        if (!window.Chart) {
          await script('https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js', true);
        }
      } catch (error) {
        console.warn('MetaLife: gráficos serão carregados quando houver conexão.', error);
      }

      for (const src of featureScripts) {
        try {
          await script(src);
          await new Promise(resolve => requestAnimationFrame(() => resolve()));
        } catch (error) {
          console.error('MetaLife: módulo opcional não carregou.', src, error);
        }
      }

      finished = true;
      document.documentElement.dataset.featuresReady = '1';
      window.dispatchEvent(new Event('metalife-features-ready'));
      return true;
    })();

    return window.mlFeaturesReady;
  }

  function panelVisible() {
    const app = document.getElementById('app');
    const auth = document.getElementById('authScreen');
    return !!app && !app.classList.contains('hidden') && !!auth && auth.classList.contains('hidden');
  }

  function scheduleStart() {
    if (started || !panelVisible()) return;
    if ('requestIdleCallback' in window) requestIdleCallback(() => loadFeatures(), { timeout: 700 });
    else setTimeout(loadFeatures, 120);
  }

  function protectFeatureNavigation(event) {
    if (finished || !started) return;
    const button = event.target.closest('[data-nav-page]');
    if (!button) return;
    const page = button.dataset.navPage;
    if (!['Comunidade','Desafios'].includes(page)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof window.toast === 'function') window.toast('Carregando este módulo…');
    Promise.resolve(window.mlFeaturesReady).then(() => {
      if (typeof window.show === 'function') window.show(page);
    });
  }

  function boot() {
    const app = document.getElementById('app');
    const auth = document.getElementById('authScreen');
    if (app) new MutationObserver(scheduleStart).observe(app, { attributes: true, attributeFilter: ['class'] });
    if (auth) new MutationObserver(scheduleStart).observe(auth, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', protectFeatureNavigation, true);
    scheduleStart();
  }

  window.mlLoadFeatures = loadFeatures;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
