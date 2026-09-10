/* MetaLife V20 — Bloco 1: gerador, plano e biblioteca visual. */
(() => {
  'use strict';
  const BLOCKED_SELECTOR = '[data-v20-start],[data-v20-refresh-week],[data-v20-progress-ex]';

  function applyStage() {
    if (document.getElementById('pageTitle')?.textContent !== 'Treino Inteligente') return;

    document.querySelectorAll('.v20-tabs [data-v20-tab="today"], .v20-tabs [data-v20-tab="progress"]')
      .forEach(button => { button.hidden = true; });

    document.querySelectorAll('[data-v20-refresh-week], [data-v20-progress-ex]')
      .forEach(button => { button.hidden = true; });

    document.querySelectorAll('[data-v20-start]').forEach(button => {
      button.disabled = true;
      button.textContent = 'Execução no Bloco 2';
      button.title = 'O registro de séries, cargas e evolução será liberado no Bloco 2.';
    });

    const hero = document.querySelector('.v20-hero p');
    if (hero) hero.textContent = 'Gere seu plano por regras, visualize a divisão e consulte os guias dos exercícios de pernas.';

    const plan = document.querySelector('#v20Panel .v20-plan-head');
    if (plan && !document.getElementById('v20StageBadge')) {
      const badge = document.createElement('span');
      badge.id = 'v20StageBadge';
      badge.className = 'pill';
      badge.textContent = 'Bloco 1';
      plan.appendChild(badge);
    }
  }

  document.addEventListener('click', event => {
    const blocked = event.target.closest?.(BLOCKED_SELECTOR);
    if (!blocked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof window.toast === 'function') {
      window.toast('Execução, cargas e evolução entram no Bloco 2.');
    }
  }, true);

  const observer = new MutationObserver(() => queueMicrotask(applyStage));
  function boot() {
    observer.observe(document.body, {childList:true, subtree:true});
    applyStage();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
