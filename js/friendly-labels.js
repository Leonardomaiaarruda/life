/* MetaLife — nomes amigáveis na interface sem alterar rotas/IDs internos. */
(() => {
  'use strict';

  const labels = [
    ['[data-v14-central]', 'Central Pessoal'],
    ['[data-v15-nav]', 'Treino & Alimentação'],
    ['[data-v16-nav]', 'Rotina & Bem-estar'],
    ['[data-v17-nav]', 'Performance & Evolução'],
    ['[data-v18-nav]', 'Social & Recompensas'],
    ['[data-v19-nav]', 'Conta & Segurança'],
    ['[data-v20-nav]', 'Treino Inteligente']
  ];

  const titles = new Map([
    ['Central V14', 'Central Pessoal'],
    ['Fitness V15', 'Treino & Alimentação'],
    ['Vida V16', 'Rotina & Bem-estar'],
    ['Performance V17', 'Performance & Evolução'],
    ['Social V18', 'Social & Recompensas'],
    ['Sistema V19', 'Conta & Segurança']
  ]);

  const eyebrowTitles = new Map([
    ['METALIFE V14', 'CENTRAL PESSOAL'],
    ['METALIFE V15', 'TREINO & ALIMENTAÇÃO'],
    ['METALIFE V16', 'ROTINA & BEM-ESTAR'],
    ['METALIFE V17', 'PERFORMANCE & EVOLUÇÃO'],
    ['METALIFE V18', 'SOCIAL & RECOMPENSAS'],
    ['METALIFE V19', 'CONTA & SEGURANÇA'],
    ['METALIFE V20', 'TREINO INTELIGENTE']
  ]);

  const groupLabels = new Map([
    ['Fitness', 'Saúde & Nutrição'],
    ['Vida', 'Rotina'],
    ['Social+', 'Social'],
    ['Sistema', 'Configurações']
  ]);

  function setButtonText(button, text) {
    if (!button) return;
    const icon = button.querySelector(':scope > span[aria-hidden="true"]');
    const current = [...button.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join('')
      .trim();
    if (current === text) return;
    [...button.childNodes].forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
    button.append(document.createTextNode(text));
    if (icon && icon.nextSibling !== button.lastChild) button.insertBefore(icon, button.firstChild);
  }

  function apply() {
    labels.forEach(([selector, text]) => setButtonText(document.querySelector(selector), text));

    document.querySelectorAll('#navGroups .nav-group-label').forEach(label => {
      const next = groupLabels.get(label.textContent.trim());
      if (next && label.textContent !== next) label.textContent = next;
    });

    const pageTitle = document.getElementById('pageTitle');
    const friendlyTitle = titles.get(pageTitle?.textContent?.trim());
    if (friendlyTitle && pageTitle.textContent !== friendlyTitle) pageTitle.textContent = friendlyTitle;

    document.querySelectorAll('#content .eyebrow').forEach(node => {
      const next = eyebrowTitles.get(node.textContent.trim());
      if (next && node.textContent !== next) node.textContent = next;
    });
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  function boot() {
    apply();
    const nav = document.getElementById('mainNav');
    const content = document.getElementById('content');
    if (nav) new MutationObserver(schedule).observe(nav, { childList: true, subtree: true });
    if (content) new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
    window.addEventListener('metalife-features-ready', schedule);
  }

  window.MetaLifeFriendlyLabels = { apply: schedule };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
