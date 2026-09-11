/* MetaLife V21.2.2 — seção Hoje mais limpa e moderna. */
(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const categories = {
    Dieta: { icon: '🥗', cls: 'diet' },
    Treino: { icon: '🏋️', cls: 'workout' },
    Cardio: { icon: '🏃', cls: 'cardio' },
    Trabalho: { icon: '💼', cls: 'work' },
    Tarefas: { icon: '✓', cls: 'tasks' },
    Outro: { icon: '•', cls: 'other' }
  };

  const categoryMeta = category => categories[category] || { icon: '•', cls: 'other' };
  const n = value => Number(value) || 0;

  function formatValue(value) {
    const number = n(value);
    return Number.isInteger(number) ? String(number) : number.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  function dailyCard(item) {
    const value = n(item.value);
    const target = n(item.target);
    const percent = pct(value, target);
    const done = percent >= 100;
    const meta = categoryMeta(item.category);
    const goal = item.goal_id
      ? state.goals?.find(goalItem => String(goalItem.id) === String(item.goal_id))
      : null;
    const unit = String(item.unit || '').trim();
    const currentText = `${formatValue(value)}${unit ? ` ${esc(unit)}` : ''}`;
    const targetText = `${formatValue(target)}${unit ? ` ${esc(unit)}` : ''}`;

    return `
      <article class="today-item ${done ? 'is-done' : ''}" data-today-category="${esc(meta.cls)}">
        <button
          type="button"
          class="today-check"
          aria-label="${done ? 'Marcar como pendente' : 'Marcar como concluído'}: ${esc(item.title || item.category || 'Item')}"
          onclick="toggleDaily('${esc(item.id)}')"
        >
          <span aria-hidden="true">${done ? '✓' : ''}</span>
        </button>

        <div class="today-category-icon" aria-hidden="true">${meta.icon}</div>

        <div class="today-item-main">
          <div class="today-item-topline">
            <div>
              <h3>${esc(item.title || item.category || 'Item do dia')}</h3>
              <span class="today-category-label">${esc(item.category || 'Outro')}</span>
            </div>
            <span class="today-status ${done ? 'done' : ''}">${done ? 'Concluído' : `${percent}%`}</span>
          </div>

          ${goal ? `
            <div class="today-goal-link">
              <span aria-hidden="true">◎</span>
              <span>Meta: ${esc(goal.name || goal.title || 'Meta')}</span>
            </div>
          ` : ''}

          <div class="today-progress-line">
            <div class="today-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
              <span style="width:${percent}%"></span>
            </div>
            <div class="today-value"><strong>${currentText}</strong><span>de ${targetText}</span></div>
          </div>
        </div>
      </article>
    `;
  }

  function renderModernToday() {
    const items = dayItems();
    const score = items.length
      ? Math.round(items.reduce((sum, item) => sum + pct(item.value, item.target), 0) / items.length)
      : 0;
    const doneCount = items.filter(item => pct(item.value, item.target) >= 100).length;

    const find = category => items.find(item => item.category === category);
    const diet = find('Dieta');
    const cardio = find('Cardio');
    const work = find('Trabalho');

    $('#content').innerHTML = `
      <div class="grid cols-4 today-summary-grid">
        <div class="card today-score-card">
          <div class="score-ring" style="--p:${score}">
            <strong>${score}%</strong>
            <small>do dia</small>
          </div>
          <div class="today-score-copy">
            <span>Progresso de hoje</span>
            <b>${doneCount} de ${items.length} concluído${items.length === 1 ? '' : 's'}</b>
          </div>
        </div>

        ${progress('Dieta', diet?.value || 0, diet?.target || 5, '/5')}
        ${progress('Cardio', cardio?.value || 0, cardio?.target || 30, ' min')}
        ${progress('Trabalho', work?.value || 0, work?.target || 4, ' h')}
      </div>

      <section class="today-section" aria-labelledby="todayHeading">
        <div class="today-section-head">
          <div>
            <div class="eyebrow">PLANO DO DIA</div>
            <h2 id="todayHeading">Hoje</h2>
            <p>${items.length ? `${doneCount} de ${items.length} item${items.length === 1 ? '' : 's'} concluído${doneCount === 1 ? '' : 's'}` : 'Organize o que precisa avançar hoje.'}</p>
          </div>
          <button type="button" class="primary today-add-button" onclick="openQuickAdd()"><span aria-hidden="true">＋</span> Adicionar</button>
        </div>

        <div class="today-list">
          ${items.length ? items.map(dailyCard).join('') : `
            <div class="today-empty">
              <div class="today-empty-icon" aria-hidden="true">✓</div>
              <div><b>Seu dia está livre</b><span>Adicione uma ação, treino, refeição ou tarefa para acompanhar seu progresso.</span></div>
              <button type="button" class="secondary" onclick="openQuickAdd()">Criar primeiro item</button>
            </div>
          `}
        </div>
      </section>

      <div class="section-head">
        <h2>Sequência & XP</h2>
      </div>

      <div class="grid cols-3">
        <div class="card">
          <div class="metric-label">Sequência atual</div>
          <div class="big">🔥 <span data-unified-streak>${window.UnifiedXP?.value('streak') ?? '—'}</span> dias</div>
        </div>
        <div class="card">
          <div class="metric-label">Nível</div>
          <div class="big"><span data-unified-level>${window.UnifiedXP?.value('level') ?? '—'}</span></div>
        </div>
        <div class="card">
          <div class="metric-label">XP integrado</div>
          <div class="big"><span data-unified-xp>${window.UnifiedXP?.value('xp') ?? '—'}</span></div>
        </div>
      </div>
    `;
  }

  window.renderToday = renderModernToday;
})();
