/* MetaLife V22.2 — diagnóstico interno de saúde do sistema. */
(() => {
  'use strict';

  const checks = async () => {
    const pending = (() => {
      try { return window.Sync?.hasPending?.() || false; } catch (_) { return false; }
    })();

    let sw = { supported: 'serviceWorker' in navigator, controlled: !!navigator.serviceWorker?.controller, scope: '' };
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg) sw = { supported: true, controlled: !!navigator.serviceWorker.controller, scope: reg.scope || '' };
    } catch (_) {}

    let cacheNames = [];
    try { cacheNames = 'caches' in window ? await caches.keys() : []; } catch (_) {}

    const challengeSync = (() => {
      if (!window.MetaLifeChallengeSync) return 'não carregado';
      try { return window.MetaLifeChallengeSync.available() ? 'disponível' : 'aguardando backend V22'; }
      catch (_) { return 'erro'; }
    })();

    const report = {
      version: window.CONFIG?.VERSION || 'desconhecida',
      runtime: '22.2',
      provider: window.CONFIG?.DATA_PROVIDER || 'desconhecido',
      online: navigator.onLine !== false,
      logged: !!localStorage.getItem('ml_token'),
      userIdPresent: !!localStorage.getItem('ml_user_id'),
      pendingSync: pending,
      featuresReady: document.documentElement.dataset.featuresReady === '1',
      modules: {
        social: !!window.Social,
        community: !!window.Community,
        challenges: !!window.MetaLifeChallengesV22,
        challengeSync,
        workoutV20: !!window.MetaLifeV20,
        workoutData: !!window.MetaLifeWorkoutData,
        workoutGuidance: !!window.MetaLifeV21
      },
      serviceWorker: sw,
      caches: cacheNames,
      supabaseRuntime: !!window.MetaLifeSupabase,
      timestamp: new Date().toISOString()
    };

    return report;
  };

  const statusLabel = value => value ? 'OK' : 'Pendente';

  async function openPanel() {
    const report = await checks();
    const html = `
      <div class="health-grid">
        <p><b>Versão configurada:</b> ${report.version}</p>
        <p><b>Runtime:</b> ${report.runtime}</p>
        <p><b>Backend:</b> ${report.provider}</p>
        <p><b>Internet:</b> ${statusLabel(report.online)}</p>
        <p><b>Sessão:</b> ${statusLabel(report.logged && report.userIdPresent)}</p>
        <p><b>Fila de sincronização:</b> ${report.pendingSync ? 'Há itens pendentes' : 'Sem pendências'}</p>
        <p><b>Módulos carregados:</b> ${statusLabel(report.featuresReady)}</p>
        <p><b>Histórico de treino unificado:</b> ${statusLabel(report.modules.workoutData)}</p>
        <p><b>Sync de desafios:</b> ${report.modules.challengeSync}</p>
        <p><b>Service Worker:</b> ${statusLabel(report.serviceWorker.supported && report.serviceWorker.controlled)}</p>
        <p><b>Cache ativo:</b> ${report.caches.length ? report.caches.join(', ') : 'nenhum'}</p>
        <p><b>Supabase no runtime:</b> ${report.supabaseRuntime ? 'sim' : 'não'}</p>
      </div>
      <details style="margin-top:12px"><summary>Dados técnicos</summary><pre style="white-space:pre-wrap;overflow:auto">${JSON.stringify(report, null, 2)}</pre></details>
    `;

    if (typeof window.openModal === 'function') window.openModal('Saúde do sistema', html);
    else console.table(report);
  }

  function injectButton() {
    const groups = document.getElementById('navGroups');
    if (!groups || groups.querySelector('[data-system-health]')) return;
    const section = document.createElement('section');
    section.className = 'nav-group';
    section.innerHTML = '<h2 class="nav-group-label">Diagnóstico</h2><button type="button" class="nav-button" data-system-health><span aria-hidden="true">⌁</span>Saúde do sistema</button>';
    section.querySelector('button').addEventListener('click', openPanel);
    groups.appendChild(section);
  }

  const observer = new MutationObserver(injectButton);
  function boot() {
    const nav = document.getElementById('mainNav');
    if (nav) observer.observe(nav, { childList: true, subtree: true });
    injectButton();
  }

  window.MetaLifeHealth = { report: checks, open: openPanel };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
