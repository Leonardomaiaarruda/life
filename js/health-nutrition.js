/* MetaLife V22.3 — Saúde & Nutrição unificados no menu principal. */
(() => {
  'use strict';

  if (window.MetaLifeHealthNutrition) return;

  let active = false;
  let currentTab = 'overview';
  let scheduled = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);

  function coreHealthButtons() {
    return [...document.querySelectorAll('#navGroups [data-nav-page]')]
      .filter(button => ['Treino', 'Dieta', 'Peso & Progresso'].includes(button.dataset.navPage));
  }

  function hideLegacyNavigation() {
    const v15 = document.querySelector('[data-v15-nav]');
    const v20 = document.querySelector('[data-v20-nav]');
    [v15, v20, ...coreHealthButtons()].forEach(button => {
      if (button) button.hidden = true;
    });

    document.querySelectorAll('#navGroups .nav-group').forEach(section => {
      if (section.dataset.healthNutrition === '1' || section.querySelector('[data-system-health]')) return;
      const buttons = [...section.querySelectorAll(':scope > .nav-button')];
      if (buttons.length && buttons.every(button => button.hidden)) section.hidden = true;
    });
  }

  function installNav() {
    const groups = document.getElementById('navGroups');
    if (!groups) return;

    hideLegacyNavigation();

    let section = groups.querySelector('[data-health-nutrition-section]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'nav-group';
      section.dataset.healthNutrition = '1';
      section.setAttribute('data-health-nutrition-section', '');
      section.innerHTML = `
        <h2 class="nav-group-label">Saúde</h2>
        <button type="button" class="nav-button" data-health-nutrition-nav>
          <span aria-hidden="true">♥</span>Saúde & Nutrição
        </button>`;
      const account = groups.querySelector('.nav-mobile-account');
      groups.insertBefore(section, account || null);
      section.querySelector('[data-health-nutrition-nav]').addEventListener('click', () => render(currentTab));
    }

    const button = section.querySelector('[data-health-nutrition-nav]');
    button?.classList.toggle('active', active);
    if (active) {
      document.querySelectorAll('#mainNav .nav-button.active').forEach(item => {
        if (item !== button && !item.classList.contains('nav-more')) item.classList.remove('active');
      });
    }
  }

  function latestWeight() {
    try {
      const rows = Array.isArray(Store.load()?.weight) ? Store.load().weight.slice() : [];
      rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      const row = rows.at(-1);
      return row ? Number(row.value ?? row.weight ?? 0) : 0;
    } catch (_) {
      return 0;
    }
  }

  function overview() {
    const host = document.getElementById('content');
    if (!host) return;
    const plan = window.MetaLifeV20?.currentPlan?.();
    const sessions = window.MetaLifeWorkoutData?.sessions?.() || window.MetaLifeV20?.sessions?.() || [];
    const weight = latestWeight();
    document.getElementById('pageTitle').textContent = 'Saúde & Nutrição';
    host.innerHTML = `
      ${tabs('overview')}
      <section class="health-nutrition-overview">
        <div class="section-head">
          <div>
            <h2>Saúde & Nutrição</h2>
            <p class="muted">Treino inteligente, execução, alimentação e evolução em um único lugar.</p>
          </div>
        </div>
        <div class="grid cols-3">
          <article class="card">
            <div class="eyebrow">TREINO INTELIGENTE</div>
            <h3>${plan ? esc(plan.name || 'Plano ativo') : 'Crie seu plano'}</h3>
            <p class="muted">${plan ? 'Seu plano inteligente está ativo e pode orientar o treino de hoje.' : 'Use objetivo, nível, frequência e disponibilidade para gerar um plano.'}</p>
            <button class="primary" data-hn-tab="smart">${plan ? 'Abrir treino inteligente' : 'Gerar meu treino'}</button>
          </article>
          <article class="card">
            <div class="eyebrow">TREINO & ALIMENTAÇÃO</div>
            <h3>${sessions.length} treino${sessions.length === 1 ? '' : 's'} no histórico</h3>
            <p class="muted">Execute fichas, registre refeições, acompanhe macros, água, alimentos e receitas.</p>
            <button class="primary" data-hn-tab="fitness">Abrir treino & alimentação</button>
          </article>
          <article class="card">
            <div class="eyebrow">PESO & PROGRESSO</div>
            <h3>${weight ? `${weight.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg` : 'Sem peso registrado'}</h3>
            <p class="muted">Acompanhe peso, medidas e evolução corporal junto do seu plano.</p>
            <button class="primary" data-hn-tab="weight">Abrir progresso</button>
          </article>
        </div>
      </section>`;
  }

  function tabs(selected = currentTab) {
    return `<nav class="v15-tabs health-nutrition-tabs" data-health-nutrition-tabs>
      <button class="chip-btn ${selected === 'overview' ? 'selected' : ''}" data-hn-tab="overview">Visão geral</button>
      <button class="chip-btn ${selected === 'smart' ? 'selected' : ''}" data-hn-tab="smart">Treino inteligente</button>
      <button class="chip-btn ${selected === 'fitness' ? 'selected' : ''}" data-hn-tab="fitness">Treino & alimentação</button>
      <button class="chip-btn ${selected === 'weight' ? 'selected' : ''}" data-hn-tab="weight">Peso & progresso</button>
    </nav>`;
  }

  function prependTabs(selected) {
    const host = document.getElementById('content');
    if (!host) return;
    host.querySelector('[data-health-nutrition-tabs]')?.remove();
    host.insertAdjacentHTML('afterbegin', tabs(selected));
  }

  function render(tab = 'overview') {
    active = true;
    currentTab = tab;
    installNav();

    if (tab === 'smart') {
      const plan = window.MetaLifeV20?.currentPlan?.();
      window.MetaLifeV20?.render?.(plan ? 'today' : 'generator');
      prependTabs('smart');
      return;
    }

    if (tab === 'fitness') {
      window.MetaLifeV15?.render?.('home');
      prependTabs('fitness');
      return;
    }

    if (tab === 'weight') {
      if (typeof window.renderWeight === 'function') window.renderWeight();
      else if (typeof renderWeight === 'function') renderWeight();
      document.getElementById('pageTitle').textContent = 'Peso & Progresso';
      prependTabs('weight');
      return;
    }

    overview();
  }

  function scheduleInstall() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      installNav();
    });
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-hn-tab]');
    if (tab) {
      event.preventDefault();
      render(tab.dataset.hnTab);
      return;
    }

    const other = event.target.closest('#mainNav [data-nav-page], #mainNav [data-v14-central], #mainNav [data-v16-nav], #mainNav [data-v17-nav], #mainNav [data-v18-nav], #mainNav [data-v19-nav], #mainNav [data-system-health]');
    if (other) active = false;
  }, true);

  function boot() {
    installNav();
    const nav = document.getElementById('mainNav');
    if (nav) new MutationObserver(scheduleInstall).observe(nav, {childList:true, subtree:true});
    window.addEventListener('metalife-features-ready', scheduleInstall);
  }

  window.MetaLifeHealthNutrition = { render, installNav };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
