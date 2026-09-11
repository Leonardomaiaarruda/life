/* MetaLife V21 — histórico orientando o próximo treino. */
(() => {
  'use strict';

  const owner = () => String(localStorage.getItem('ml_user_id') || 'demo');
  const v20Key = name => 'ml_v20_' + encodeURIComponent(owner()) + '_' + name;
  const v15Key = name => 'ml_v15_' + encodeURIComponent(owner()) + '_' + name;
  const arr = value => Array.isArray(value) ? value : [];
  const num = value => Number(value) || 0;
  const hasNumber = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const fmt = value => {
    if (!value) return '—';
    const raw = String(value).slice(0, 10);
    const date = new Date(raw + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };
  const round05 = value => Math.round(Number(value) * 2) / 2;
  const median = values => {
    const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  function library() {
    return arr(window.MetaLifeV20?.library);
  }

  function sourceSessions() {
    const merged = new Map();
    const local = arr(window.MetaLifeV20?.sessions?.()).concat(arr(read(v15Key('sessions'), [])));
    let synced = [];
    try {
      synced = arr(window.Store?.load?.()?.workouts);
    } catch (_) {}

    [...local, ...synced].forEach((session, index) => {
      if (!session || !arr(session.exercises).length) return;
      const id = String(session.id || session.sessionId || `${session.date || session.endedAt || 'session'}|${session.name || ''}|${index}`);
      const old = merged.get(id);
      if (!old || String(session.updatedAt || session.endedAt || '') > String(old.updatedAt || old.endedAt || '')) merged.set(id, session);
    });

    return [...merged.values()].sort((a, b) => String(a.endedAt || a.date || '').localeCompare(String(b.endedAt || b.date || '')));
  }

  function exerciseOf(session, exerciseId, exerciseName) {
    return arr(session.exercises).find(item =>
      String(item.id || item.exerciseId || '') === String(exerciseId || '') ||
      String(item.name || '').trim().toLowerCase() === String(exerciseName || '').trim().toLowerCase()
    );
  }

  function normalizedSets(item) {
    return arr(item?.sets).filter(set => {
      if (set?.done === false) return false;
      return hasNumber(set?.kg) || hasNumber(set?.reps);
    }).map(set => ({
      kg: hasNumber(set.kg) ? Number(set.kg) : 0,
      reps: hasNumber(set.reps) ? Number(set.reps) : 0,
      rir: hasNumber(set.rir) ? Number(set.rir) : null,
      rpe: hasNumber(set.rpe) ? Number(set.rpe) : null
    }));
  }

  function history(exerciseId, exerciseName, limit = 8) {
    const rows = [];
    sourceSessions().forEach(session => {
      const item = exerciseOf(session, exerciseId, exerciseName);
      const sets = normalizedSets(item);
      if (!sets.length) return;
      const loads = sets.map(set => set.kg).filter(value => value > 0);
      const reps = sets.map(set => set.reps).filter(value => value > 0);
      const oneRms = sets.filter(set => set.kg > 0 && set.reps > 0 && set.reps <= 20).map(set => set.kg * (1 + set.reps / 30));
      const rirs = sets.map(set => set.rir).filter(value => value !== null);
      const rpes = sets.map(set => set.rpe).filter(value => value !== null);
      rows.push({
        sessionId: session.id || '',
        date: session.date || String(session.endedAt || session.createdAt || '').slice(0, 10),
        endedAt: session.endedAt || session.updatedAt || '',
        sets,
        setCount: sets.length,
        representativeLoad: median(loads),
        topLoad: loads.length ? Math.max(...loads) : 0,
        avgReps: reps.length ? reps.reduce((a, b) => a + b, 0) / reps.length : 0,
        minReps: reps.length ? Math.min(...reps) : 0,
        maxReps: reps.length ? Math.max(...reps) : 0,
        volume: sets.reduce((total, set) => total + set.kg * set.reps, 0),
        oneRM: oneRms.length ? Math.max(...oneRms) : 0,
        avgRir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null,
        avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null
      });
    });
    return rows.slice(-limit);
  }

  function stagnated(rows) {
    const recent = rows.slice(-3);
    if (recent.length < 3) return false;
    const best = recent.map(row => row.oneRM || row.topLoad || row.avgReps);
    const first = best[0] || 0;
    const last = best.at(-1) || 0;
    if (!first) return false;
    return (last - first) / first < 0.02;
  }

  function recommendation(exercise, prescription) {
    const rows = history(exercise?.id, exercise?.name, 8);
    const targetMin = Math.max(1, num(prescription?.min) || num(exercise?.baseMin) || 8);
    const targetMax = Math.max(targetMin, num(prescription?.max) || num(exercise?.baseMax) || 12);
    const targetSets = Math.max(1, num(prescription?.sets) || num(exercise?.baseSets) || 3);
    if (!rows.length) {
      return {
        status: 'primeira', title: 'Primeiro registro', rows, suggestedLoad: 0,
        text: `Ainda não há histórico deste exercício. Escolha uma carga que permita ${targetMin}–${targetMax} repetições com técnica controlada e registre RPE/RIR para melhorar a próxima sugestão.`,
        reason: 'A orientação ficará mais precisa depois das primeiras sessões.'
      };
    }

    const last = rows.at(-1);
    const previous = rows.at(-2);
    const baseLoad = last.representativeLoad || last.topLoad;
    const enoughSets = last.setCount >= Math.max(1, targetSets - 1);
    const reachedTop = enoughSets && last.sets.every(set => !set.reps || set.reps >= targetMax);
    const belowRange = last.avgReps > 0 && last.avgReps < targetMin;
    const effortHigh = (last.avgRir !== null && last.avgRir <= 0.5) || (last.avgRpe !== null && last.avgRpe >= 9.5);
    const effortControlled = (last.avgRir === null || last.avgRir >= 1) && (last.avgRpe === null || last.avgRpe <= 9);
    const repeatedHard = !!previous && belowRange && (
      (previous.avgReps > 0 && previous.avgReps < targetMin) ||
      (previous.avgRir !== null && previous.avgRir <= 0.5) ||
      (previous.avgRpe !== null && previous.avgRpe >= 9.5)
    );
    const isTimed = !!exercise?.timeUnit || exercise?.format === 'min' || exercise?.format === 'sec' || exercise?.category === 'Cardio';

    if (isTimed || !baseLoad) {
      const nextReps = Math.min(targetMax, Math.max(targetMin, Math.round(last.avgReps || targetMin) + (last.avgReps >= targetMax ? 0 : 1)));
      return {
        status: reachedTop ? 'progredir' : 'manter', title: reachedTop ? 'Aumente um pouco a dificuldade' : 'Progrida o desempenho', rows, suggestedLoad: 0,
        targetReps: nextReps,
        text: reachedTop
          ? `Você atingiu o topo da faixa na última sessão. Mantenha a execução e aumente levemente duração, repetições ou dificuldade.`
          : `Repita o exercício e tente chegar perto de ${nextReps} dentro da faixa de ${targetMin}–${targetMax}.`,
        reason: `${rows.length} sessão(ões) consideradas · última média ${last.avgReps ? last.avgReps.toFixed(1) : '—'}.`
      };
    }

    if (reachedTop && effortControlled) {
      const increase = Math.max(0.5, baseLoad * 0.025);
      const nextLoad = round05(baseLoad + increase);
      return {
        status: 'progredir', title: 'Subir carga', rows, suggestedLoad: nextLoad, targetReps: targetMin,
        text: `Na última sessão você completou a faixa alta. Sugestão para hoje: ${nextLoad.toFixed(1)} kg e buscar ${targetMin}–${targetMax} repetições.`,
        reason: `Base: ${baseLoad.toFixed(1)} kg · ${last.avgReps.toFixed(1)} reps médias${last.avgRir !== null ? ` · RIR ${last.avgRir.toFixed(1)}` : ''}${last.avgRpe !== null ? ` · RPE ${last.avgRpe.toFixed(1)}` : ''}.`
      };
    }

    if (repeatedHard && baseLoad > 0) {
      const nextLoad = round05(Math.max(0.5, baseLoad * 0.95));
      return {
        status: 'reduzir', title: 'Recuar levemente', rows, suggestedLoad: nextLoad, targetReps: targetMin,
        text: `Duas sessões seguidas ficaram abaixo da faixa ou muito próximas da falha. Sugestão: ${nextLoad.toFixed(1)} kg e reconstruir a execução dentro de ${targetMin}–${targetMax} repetições.`,
        reason: 'A redução é pequena e serve para recuperar margem de progressão; você pode ignorá-la se houve um motivo pontual.'
      };
    }

    const nextRep = Math.min(targetMax, Math.max(targetMin, Math.floor(last.avgReps || targetMin) + 1));
    const stalled = stagnated(rows);
    return {
      status: stalled ? 'estagnado' : 'manter', title: stalled ? 'Progressão curta estagnada' : 'Manter carga e ganhar repetições', rows,
      suggestedLoad: round05(baseLoad), targetReps: nextRep,
      text: stalled
        ? `O desempenho mudou pouco nas últimas 3 sessões. Mantenha ${round05(baseLoad).toFixed(1)} kg e tente melhorar repetições ou técnica antes de trocar o exercício.`
        : `Repita aproximadamente ${round05(baseLoad).toFixed(1)} kg e tente chegar a cerca de ${nextRep} repetições por série sem sair da faixa proposta.`,
      reason: effortHigh
        ? 'A última sessão teve esforço alto; não há motivo para subir carga agora.'
        : `Última média: ${last.avgReps.toFixed(1)} reps${last.avgRir !== null ? ` · RIR ${last.avgRir.toFixed(1)}` : ''}${last.avgRpe !== null ? ` · RPE ${last.avgRpe.toFixed(1)}` : ''}.`
    };
  }

  function activeState() {
    return read(v20Key('active'), null);
  }

  function currentRecommendation() {
    const active = activeState();
    if (!active?.exercises?.length) return null;
    const item = active.exercises[active.current || 0];
    const exercise = library().find(ex => String(ex.id) === String(item.id)) || item;
    return { active, item, exercise, rec: recommendation(exercise, item.prescription || {}) };
  }

  function rowSummary(rec) {
    const last = rec.rows.at(-1);
    if (!last) return '';
    const top = last.sets.slice().sort((a, b) => (b.kg * b.reps) - (a.kg * a.reps))[0] || last.sets[0];
    const pieces = [`${fmt(last.date)}`];
    if (top?.kg) pieces.push(`${top.kg.toFixed(1)} kg × ${top.reps || '—'}`);
    else if (top?.reps) pieces.push(`${top.reps} reps`);
    if (last.avgRir !== null) pieces.push(`RIR ${last.avgRir.toFixed(1)}`);
    else if (last.avgRpe !== null) pieces.push(`RPE ${last.avgRpe.toFixed(1)}`);
    return pieces.join(' · ');
  }

  function guidanceHtml(rec) {
    const recent = rec.rows.slice(-4).reverse();
    return `<section class="v21-guidance v21-${esc(rec.status)}" id="v21CurrentGuidance">
      <div class="v21-guidance-head">
        <div><div class="eyebrow">HISTÓRICO → PRÓXIMO TREINO</div><h3>${esc(rec.title)}</h3></div>
        <span class="v21-count">${rec.rows.length} sessão(ões)</span>
      </div>
      <p class="v21-main">${esc(rec.text)}</p>
      <p class="v21-reason">${esc(rec.reason)}</p>
      ${recent.length ? `<div class="v21-recent">${recent.map(row => `<div><b>${fmt(row.date)}</b><span>${row.topLoad ? `${row.topLoad.toFixed(1)} kg` : `${Math.round(row.avgReps)} reps`}</span><small>${row.avgReps ? row.avgReps.toFixed(1) + ' reps médias' : 'registro'}</small></div>`).join('')}</div>` : ''}
      ${rec.suggestedLoad > 0 ? `<button type="button" class="chip-btn" data-v21-apply-load="${rec.suggestedLoad}">Usar ${rec.suggestedLoad.toFixed(1)} kg nas séries</button>` : ''}
      <small class="muted">Sugestão editável. O MetaLife não altera sua carga sem você confirmar.</small>
    </section>`;
  }

  function enhanceExecution() {
    if (!document.querySelector('.v20-execute')) return;
    const current = currentRecommendation();
    if (!current) return;
    const anchor = document.querySelector('.v20-progression') || document.querySelector('.v20-set-list');
    if (!anchor) return;
    const signature = [current.item.id, current.rec.rows.at(-1)?.date, current.rec.suggestedLoad, current.rec.title].join('|');
    let node = document.getElementById('v21CurrentGuidance');
    if (node?.dataset.signature === signature) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = guidanceHtml(current.rec);
    const next = wrapper.firstElementChild;
    next.dataset.signature = signature;
    if (node) node.replaceWith(next);
    else anchor.before(next);
  }

  function enhanceRows() {
    document.querySelectorAll('.v20-ex-row').forEach(row => {
      const button = row.querySelector('[data-v20-exercise]');
      const body = row.querySelector(':scope > div:last-child');
      if (!button || !body) return;
      const id = button.dataset.v20Exercise;
      const exercise = library().find(ex => String(ex.id) === String(id));
      if (!exercise) return;
      const targetText = body.querySelector('span')?.textContent || '';
      const match = targetText.match(/(\d+)\s*séries\s*·\s*(\d+)[–-](\d+)/i);
      const prescription = match ? { sets: Number(match[1]), min: Number(match[2]), max: Number(match[3]) } : {};
      const rec = recommendation(exercise, prescription);
      const signature = `${id}|${rec.rows.at(-1)?.date || ''}|${rec.title}|${rec.suggestedLoad}`;
      let tip = body.querySelector('.v21-row-tip');
      if (tip?.dataset.signature === signature) return;
      if (!tip) {
        tip = document.createElement('small');
        tip.className = 'v21-row-tip';
        body.appendChild(tip);
      }
      tip.dataset.signature = signature;
      tip.innerHTML = rec.rows.length
        ? `<b>${esc(rec.title)}:</b> ${esc(rec.suggestedLoad > 0 ? `${rec.suggestedLoad.toFixed(1)} kg` : rec.text)}<span>Última: ${esc(rowSummary(rec))}</span>`
        : '<b>Sem histórico:</b> registre esta sessão para receber orientação na próxima.';
    });
  }

  function enhanceProgress() {
    const select = document.getElementById('v20HistoryExercise');
    const panel = document.getElementById('v20Panel');
    if (!select || !panel) return;
    const exercise = library().find(ex => String(ex.id) === String(select.value));
    if (!exercise) return;
    const rec = recommendation(exercise, {});
    let card = document.getElementById('v21ProgressAdvice');
    const signature = `${exercise.id}|${rec.rows.at(-1)?.date || ''}|${rec.title}|${rec.suggestedLoad}`;
    if (card?.dataset.signature === signature) return;
    if (!card) {
      card = document.createElement('article');
      card.id = 'v21ProgressAdvice';
      card.className = 'card v21-progress-advice';
      panel.prepend(card);
    }
    card.dataset.signature = signature;
    card.innerHTML = `<div class="eyebrow">ORIENTAÇÃO PARA A PRÓXIMA SESSÃO</div><h3>${esc(exercise.name)}</h3><p class="v21-main">${esc(rec.text)}</p><p class="v21-reason">${esc(rec.reason)}</p>${rec.rows.length ? `<small>Último registro: ${esc(rowSummary(rec))}</small>` : ''}`;
  }

  function applySuggestedLoad(value) {
    const load = Number(value);
    if (!Number.isFinite(load) || load <= 0) return;
    const inputs = [...document.querySelectorAll('.v20-set input[data-v20-set="kg"]')];
    if (!inputs.length) return;
    inputs.forEach(input => {
      input.value = String(load);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    if (typeof window.toast === 'function') window.toast(`Sugestão de ${load.toFixed(1)} kg aplicada. Você ainda pode editar cada série.`);
  }

  let scheduled = false;
  function apply() {
    scheduled = false;
    if (document.getElementById('pageTitle')?.textContent !== 'Treino Inteligente') return;
    enhanceExecution();
    enhanceRows();
    enhanceProgress();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('click', event => {
    const applyButton = event.target.closest('[data-v21-apply-load]');
    if (applyButton) {
      event.preventDefault();
      applySuggestedLoad(applyButton.dataset.v21ApplyLoad);
      return;
    }
    if (event.target.closest('[data-v20-tab],[data-v20-start],[data-v20-next],[data-v20-prev],[data-v20-done],[data-v20-finish],[data-v20-refresh-week]')) {
      setTimeout(schedule, 0);
    }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'v20HistoryExercise') setTimeout(schedule, 0);
  });
  window.addEventListener('metalife-data-saved', schedule);
  window.addEventListener('metalife-v15-change', schedule);
  window.addEventListener('storage', event => {
    if (event.key?.includes('_sessions') || event.key?.includes('_active')) schedule();
  });

  function boot() {
    const content = document.getElementById('content');
    if (content) new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
    schedule();
  }

  window.MetaLifeV21 = { history, recommendation, refresh: schedule };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
