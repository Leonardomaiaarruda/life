/* MetaLife — correção de estabilidade do login e observadores de UI. */
(() => {
  'use strict';

  let patched = false;

  function installMutationObserverGuard() {
    if (window.__mlMutationGuardInstalled || typeof window.MutationObserver !== 'function') return;
    const NativeMutationObserver = window.MutationObserver;

    class MetaLifeMutationObserver extends NativeMutationObserver {
      constructor(callback) {
        super((records, observer) => {
          /* A V14 mantém um observador amplo no body e atualiza o próprio contador
             de notificações dentro da callback. Essa alteração gera uma nova mutação
             e pode virar um ciclo infinito. Mudanças internas do contador não precisam
             disparar nenhum observador funcional do app, então são descartadas aqui. */
          const meaningful = records.filter(record => {
            const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
            return !target?.closest?.('#v14Tools');
          });
          if (meaningful.length) callback(meaningful, observer);
        });
      }
    }

    window.MutationObserver = MetaLifeMutationObserver;
    window.__mlMutationGuardInstalled = true;
  }

  function patchBoot() {
    if (patched || typeof window.boot !== 'function') return;
    const originalBoot = window.boot;

    async function bootWithoutBlockingLogin(...args) {
      let running;
      try {
        running = originalBoot.apply(this, args);
      } catch (error) {
        console.error('MetaLife: falha ao iniciar o painel.', error);
        throw error;
      }

      /* O painel já foi desenhado de forma síncrona pelo boot original.
         A sincronização remota continua, mas não mantém o overlay de login na tela. */
      Promise.resolve(running).catch(error => {
        console.error('MetaLife: sincronização inicial falhou.', error);
      });

      setTimeout(() => {
        const content = document.getElementById('content');
        if (content) content.inert = false;
      }, 180);

      return undefined;
    }

    bootWithoutBlockingLogin.__metalifeLoginStable = true;
    window.boot = bootWithoutBlockingLogin;
    patched = true;
  }

  function neutralizeV14ObserverLoop() {
    const tools = document.getElementById('v14Tools');
    const bell = tools?.querySelector('.v14-bell');
    const badge = bell?.querySelector('span');
    if (!bell || !badge) return;

    const count = String(badge.textContent || '').trim();
    const label = count ? `Notificações: ${count}` : 'Notificações';
    if (bell.getAttribute('aria-label') !== label) bell.setAttribute('aria-label', label);
  }

  function clearOrphanLoginOverlay() {
    if (!document.getElementById('authScreen')?.classList.contains('hidden')) {
      document.querySelectorAll('.login-loading-overlay').forEach(node => node.remove());
      const form = document.getElementById('loginForm');
      if (form?.dataset.loading === 'true' && !form.matches(':focus-within')) {
        form.dataset.loading = 'false';
        form.removeAttribute('aria-busy');
      }
    }
  }

  function install() {
    installMutationObserverGuard();
    patchBoot();
    neutralizeV14ObserverLoop();
    clearOrphanLoginOverlay();

    [0, 60, 250, 900, 1800, 3200].forEach(delay => setTimeout(() => {
      patchBoot();
      neutralizeV14ObserverLoop();
    }, delay));

    window.addEventListener('metalife-features-ready', neutralizeV14ObserverLoop);
  }

  /* O guard precisa existir antes dos módulos carregados depois do login. */
  installMutationObserverGuard();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
