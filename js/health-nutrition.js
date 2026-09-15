/* MetaLife V22.3.1 — Saúde & Nutrição como tela única. */
(() => {
  'use strict';

  if (window.MetaLifeHealthNutrition) return;

  let active = false;
  let area = 'training';
  let trainingMode = 'smart';
  let scheduledNav = false;
  let scheduledFrame = false;
  let contentObserver = null;

  function coreHealthButtons() {
    return [...document.querySelectorAll('#navGroups [data-nav-page]')]
      .filter(button => ['Treino', 'Dieta', 'Peso & Progresso'].includes(button.dataset.navPage));
  }

  function hideLegacyNavigation() {
    const legacy = [
      document.querySelector('[data-v15-nav]'),
      document.querySelector('[data-v20-nav]'),
      ...coreHealthButtons()
    ].filter(Boolean);

    legacy.forEach(button => {
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
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
      section.querySelector('[data-health-nutrition-nav]').addEventListener('click', () => render(area));
    }

    section.hidden = false;
    const button = section.querySelector('[data-health-nutrition-nav]');
    button?.classList.toggle('active', active);
    button?.setAttribute('aria-current', active ? 'page' : 'false');

    if (active) {
      document.querySelectorAll('#mainNav .nav-button.active').forEach(item => {
        if (item !== button && !item.classList.contains('nav-more')) item.classList.remove('active');
      });
    }
  }

  function unifiedTabs() {
    return `<nav class="v15-tabs health-nutrition-tabs" data-health-nutrition-tabs aria-label="Saúde e Nutrição">
      <button type="button" class="chip-btn ${area === 'training' ? 'selected' : ''}" data-hn-area="training">Treino</button>
      <button type="button" class="chip-btn ${area === 'nutrition' ? 'selected' : ''}" data-hn-area="nutrition">Alimentação</button>
      <button type="button" class="chip-btn ${area === 'weight' ? 'selected' : ''}" data-hn-area="weight">Peso & Progresso</button>
    </nav>`;
  }

  function trainingTabs() {
    if (area !== 'training') return '';
    return `<div class="health-nutrition-training-switch" data-health-training-switch style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px">
      <button type="button" class="chip-btn ${trainingMode === 'smart' ? 'selected' : ''}" data-hn-training="smart">Treino Inteligente</button>
      <button type="button" class="chip-btn ${trainingMode === 'execution' ? 'selected' : ''}" data-hn-training="execution">Execução, fichas e histórico</button>
    </div>`;
  }

  function frameHtml() {
    return `<section data-health-nutrition-frame>
      <div class="section-head" style="margin-top:0">
        <div>
          <div class="eyebrow">SAÚDE & NUTRIÇÃO</div>
          <h2>${area === 'training' ? 'Treino' : area === 'nutrition' ? 'Alimentação' : 'Peso & Progresso'}</h2>
          <p class="muted">${area === 'training'
            ? 'O Treino Inteligente e a execução das fichas agora ficam dentro da mesma área.'
            : area === 'nutrition'
              ? 'Registro alimentar, macros, água, alimentos e receitas em uma única tela.'
              : 'Acompanhe peso e evolução corporal junto do restante da sua saúde.'}</p>
        </div>
      </div>
      ${unifiedTabs()}
      ${trainingTabs()}
    </section>`;
  }

  function ensureFrame() {
    if (!active) return;
    const host = document.getElementById('content');
    const title = document.getElementById('pageTitle');
    if (!host || !title) return;

    if (title.textContent !== 'Saúde & Nutrição') title.textContent = 'Saúde & Nutrição';

    let frame = host.querySelector('[data-health-nutrition-frame]');
    if (!frame) {
      host.insertAdjacentHTML('afterbegin', frameHtml());
      frame = host.querySelector('[data-health-nutrition-frame]');
    } else {
      const expectedArea = frame.querySelector(`[data-hn-area="${area}"]`);
      const expectedTraining = area !== 'training' || frame.querySelector(`[data-hn-training="${trainingMode}"]`);
      if (!expectedArea || !expectedTraining) frame.outerHTML = frameHtml();
      else {
        frame.querySelectorAll('[data-hn-area]').forEach(button => button.classList.toggle('selected', button.dataset.hnArea === area));
        frame.querySelectorAll('[data-hn-training]').forEach(button => button.classList.toggle('selected', button.dataset.hnTraining === trainingMode));
      }
    }

    installNav();
  }

  function scheduleFrame() {
    if (!active || scheduledFrame) return;
    scheduledFrame = true;
    requestAnimationFrame(() => {
      scheduledFrame = false;
      ensureFrame();
    });
  }

  function observeContent() {
    if (contentObserver) return;
    const host = document.getElementById('content');
    if (!host) return;
    contentObserver = new MutationObserver(scheduleFrame);
    contentObserver.observe(host, {childList:true, subtree:false});
  }

  function renderTraining() {
    if (trainingMode === 'execution') {
      window.MetaLifeV15?.render?.('home');
    } else {
      const plan = window.MetaLifeV20?.currentPlan?.();
      window.MetaLifeV20?.render?.(plan ? 'today' : 'generator');
    }
    ensureFrame();
  }

  function renderNutrition() {
    window.MetaLifeV15?.render?.('nutrition');
    ensureFrame();
  }

  function renderWeightArea() {
    if (typeof window.renderWeight === 'function') window.renderWeight();
    else if (typeof renderWeight === 'function') renderWeight();
    ensureFrame();
  }

  function render(nextArea = 'training') {
    active = true;
    area = ['training', 'nutrition', 'weight'].includes(nextArea) ? nextArea : 'training';
    installNav();
    observeContent();

    if (area === 'training') renderTraining();
    else if (area === 'nutrition') renderNutrition();
    else renderWeightArea();
  }

  function scheduleInstall() {
    if (scheduledNav) return;
    scheduledNav = true;
    requestAnimationFrame(() => {
      scheduledNav = false;
      installNav();
      if (active) ensureFrame();
    });
  }

  document.addEventListener('click', event => {
    const areaButton = event.target.closest('[data-hn-area]');
    if (areaButton) {
      event.preventDefault();
      render(areaButton.dataset.hnArea);
      return;
    }

    const trainingButton = event.target.closest('[data-hn-training]');
    if (trainingButton) {
      event.preventDefault();
      trainingMode = trainingButton.dataset.hnTraining === 'execution' ? 'execution' : 'smart';
      area = 'training';
      renderTraining();
      return;
    }

    const v15Tab = event.target.closest('[data-v15-tab]');
    if (active && v15Tab) {
      const tab = String(v15Tab.dataset.v15Tab || '');
      if (['nutrition', 'foods', 'recipes', 'settings'].includes(tab)) area = 'nutrition';
      else {
        area = 'training';
        trainingMode = 'execution';
      }
      scheduleFrame();
      return;
    }

    const v20Tab = event.target.closest('[data-v20-tab]');
    if (active && v20Tab) {
      area = 'training';
      trainingMode = 'smart';
      scheduleFrame();
      return;
    }

    const other = event.target.closest('#mainNav [data-nav-page], #mainNav [data-v14-central], #mainNav [data-v16-nav], #mainNav [data-v17-nav], #mainNav [data-v18-nav], #mainNav [data-v19-nav], #mainNav [data-system-health]');
    if (other && !other.hidden) {
      active = false;
      installNav();
    }
  }, true);

  function boot() {
    installNav();
    observeContent();
    const nav = document.getElementById('mainNav');
    if (nav) new MutationObserver(scheduleInstall).observe(nav, {childList:true, subtree:true});
    window.addEventListener('metalife-features-ready', scheduleInstall);
  }

  window.MetaLifeHealthNutrition = {
    render,
    installNav,
    openTraining: mode => {
      trainingMode = mode === 'execution' ? 'execution' : 'smart';
      render('training');
    },
    openNutrition: () => render('nutrition'),
    openWeight: () => render('weight')
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
