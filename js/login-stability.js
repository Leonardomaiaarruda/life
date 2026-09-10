/* MetaLife — correção de estabilidade do login e observadores de UI. */
(() => {
  'use strict';

  let patched = false;

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
    /* v14.js observa alterações em todo o body e também atualiza este span.
       Alterar textContent do próprio span dispara o mesmo observer novamente.
       O contador continua disponível via aria-label do botão, sem manter o nó mutável. */
    const tools = document.getElementById('v14Tools');
    const bell = tools?.querySelector('.v14-bell');
    const badge = bell?.querySelector('span');
    if (!bell || !badge) return;

    const count = String(badge.textContent || '').trim();
    if (count) bell.setAttribute('aria-label', `Notificações: ${count}`);
    else bell.setAttribute('aria-label', 'Notificações');
    badge.remove();
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
    patchBoot();
    neutralizeV14ObserverLoop();
    clearOrphanLoginOverlay();

    /* Roda poucas vezes durante o carregamento inicial; não cria um novo observer global. */
    [0, 60, 250, 900, 1800].forEach(delay => setTimeout(() => {
      patchBoot();
      neutralizeV14ObserverLoop();
    }, delay));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
