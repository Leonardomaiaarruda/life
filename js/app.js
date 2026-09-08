const $ = selector => document.querySelector(selector);

let state = Store.load();
let currentPage = "Meu Dia";
let charts = [];

const NAV = [
  ["Meu Dia", "◉"],
  ["Metas", "◎"],
  ["Treino", "🏋"],
  ["Dieta", "🥗"],
  ["Hábitos", "🔥"],
  ["Peso & Progresso", "⚖"],
  ["Trabalho & Tarefas", "✓"],
  ["Meu Progresso", "◫"],
  ["Pessoas", "👥"],
  ["Desafios", "🏆"],
  ["Chats", "💬"]
];

/* =========================
   UTILIDADES
========================= */

function iso(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function fmtDate(date = new Date()) {
  const value =
    date instanceof Date
      ? date
      : new Date(`${normalizeDate(date)}T12:00:00`);

  return value.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });
}

function pct(value, target) {
  if (!target) return 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round((value / target) * 100)
    )
  );
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function saveLocal() {
  Store.save(state);
}

function toast(message) {
  const element = document.createElement("div");

  element.className = "toast-item";
  element.textContent = message;

  $("#toast").appendChild(element);

  setTimeout(() => {
    element.remove();
  }, 2200);
}

function clearCharts() {
  charts.forEach(chart => chart?.destroy?.());
  charts = [];
}

function isLogged() {
  return !!localStorage.getItem("ml_token");
}

/* =========================
   API
========================= */

async function api(action, data = {}) {
  const token = localStorage.getItem("ml_token");
  const response = await API.call(action, data);
  if (token !== localStorage.getItem("ml_token")) return { ok: false, stale: true };
  if ((!response || !response.ok) && /^(save|delete|update|create|send|invite|accept|reject|cancel|leave)/.test(action)) {
    let warning = document.querySelector("#saveWarning");
    if (!warning) {
      warning = document.createElement("div");
      warning.id = "saveWarning";
      warning.setAttribute("role", "alert");
      warning.style.cssText = "padding:12px 16px;background:#fff3cd;color:#664d03;border:1px solid #ffecb5;border-radius:12px;margin:12px 0";
      document.querySelector(".topbar").after(warning);
    }
    warning.textContent = "Não foi possível confirmar a alteração no servidor. Confira sua conexão e tente a ação novamente. Os dados exibidos podem estar apenas neste navegador.";
    toast("Alteração não confirmada no servidor.");
  }

  if (!response || !response.ok) {
    console.warn("API:", action, response);
  }

  return response;
}

async function syncFromServer() {
  if (!isLogged()) return;
  const syncToken = localStorage.getItem("ml_token");

  try {
    const [
      dailyResponse,
      goalResponse,
      weightResponse,
      taskResponse,
      workoutResponse,
      dietResponse,
      habitResponse,
      checkinResponse,
      reviewResponse
    ] = await Promise.all([
      api("listDaily"),
      api("listGoals"),
      api("listWeight"),
      api("listTasks"),
      api("listWorkouts"),
      api("listDiet"),
      api("listHabits"),
      api("listCheckins"),
      api("listWeeklyReviews")
    ]);

    if (syncToken !== localStorage.getItem("ml_token")) return;
    const itemsOf = response => {
      if (Array.isArray(response)) return response;
      if (Array.isArray(response?.items)) return response.items;
      if (Array.isArray(response?.data)) return response.data;
      return [];
    };

    if (dailyResponse?.ok) {
      state.daily = itemsOf(dailyResponse).map(item => ({
        ...item,
        date: normalizeDate(item.date)
      }));
    }

    if (goalResponse?.ok) {
      state.goals = itemsOf(goalResponse);
    }

    if (weightResponse?.ok) {
      state.weight = itemsOf(weightResponse).map(item => ({
        ...item,
        date: normalizeDate(item.date)
      }));
    }

    if (taskResponse?.ok) {
      state.tasks = itemsOf(taskResponse);
    }

    if (workoutResponse?.ok) {
      state.workouts = itemsOf(workoutResponse).filter(item => !item.deleted);
    }

    if (habitResponse?.ok) {
      state.habits = itemsOf(habitResponse).filter(item => !item.deleted);
    }

    if (dietResponse?.ok) {
      const diets = itemsOf(dietResponse);
      const latestDiet = diets.at(-1);
      state.diet = latestDiet?.deleted ? null : (latestDiet || state.diet || null);
    }

    if (checkinResponse?.ok) {
      state.checkins = {};
      itemsOf(checkinResponse).forEach(item => {
        const key = normalizeDate(item.date);
        state.checkins[key] = item;
      });
    }

    if (reviewResponse?.ok) {
      state.weeklyReviews = itemsOf(reviewResponse);
    }

    // Desafios são sincronizados separadamente para manter compatibilidade
    // com backends antigos que ainda não possuem o módulo.
    try {
      const challengeResponse = await api("listChallenges");
      if (syncToken !== localStorage.getItem("ml_token")) return;
      if (challengeResponse?.ok) {
        state.challenges = Array.isArray(challengeResponse.items)
          ? challengeResponse.items
          : Array.isArray(challengeResponse.challenges)
            ? challengeResponse.challenges
            : [];
      }
    } catch (challengeError) {
      console.warn("Desafios ainda não disponíveis no backend.", challengeError);
    }

    saveLocal();

  } catch (error) {
    console.error(error);
    toast("Não foi possível sincronizar alguns dados.");
  }
}

function normalizeDate(value) {
  if (!value) return iso();

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return iso(new Date(value));
}

/* =========================
   BOOT
========================= */

async function boot() {
  $("#authScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");

  $("#currentDate").textContent = fmtDate();

  renderUserBadge();
  renderNav();

  show("Meu Dia");
  if (isLogged()) {
    const bootToken = localStorage.getItem("ml_token");
    mlStartMessageNotifications();
    const loading = document.createElement("p");
    loading.className = "muted";
    loading.textContent = "Atualizando seus dados…";
    loading.setAttribute("role", "status");
    document.querySelector(".topbar").after(loading);
    $("#content").inert = true;
    try {
      await syncFromServer();
      if (bootToken !== localStorage.getItem("ml_token")) return;
      await ensureGoalDailyItems();
      if (bootToken !== localStorage.getItem("ml_token")) return;
      renderUserBadge();
      if (currentPage !== "Chats") show(currentPage);
    } finally {
      loading.remove();
      if (bootToken === localStorage.getItem("ml_token")) $("#content").inert = false;
    }
  }

  renderUserBadge();
  window.mlPwaAfterLogin?.();
  let guide = document.querySelector("#dailyGuide");
  if (!guide) {
    guide = document.createElement("p");
    guide.id = "dailyGuide";
    guide.className = "muted";
    guide.textContent = "Comece pelo Meu Dia: escolha suas prioridades e marque o que concluir. Use o menu para acompanhar metas, hábitos e progresso.";
    document.querySelector(".topbar").after(guide);
  }
}

function renderUserBadge() {
  $("#userBadge").innerHTML = `
    <b>${state.user?.name || "Usuário"}</b>
    <br>
    <span>
      Nível ${state.user?.level || 1}
      ·
      ${state.user?.xp || 0} XP
    </span>
  `;
}

/* =========================
   NAVEGAÇÃO
========================= */

function renderNav() {
  const button = name => {
    const icon = NAV.find(item => item[0] === name)?.[1] || "◉";
    return `<button type="button" data-nav-page="${name}" class="nav-button ${name === currentPage ? "active" : ""}"
      ${name === currentPage ? 'aria-current="page"' : ''} onclick="show('${name}')"><span aria-hidden="true">${icon}</span>${name}</button>`;
  };
  const groups = [
    ["Planejamento", ["Metas", "Hábitos", "Trabalho & Tarefas"]],
    ["Saúde", ["Treino", "Dieta", "Peso & Progresso"]],
    ["Comunidade", ["Pessoas", "Desafios", "Chats"]]
  ];
  const moreActive = groups.some(([, names]) => names.includes(currentPage));
  $("#mainNav").innerHTML = `
    <div class="nav-home">${button("Meu Dia")}</div>
    <div class="nav-progress">${button("Meu Progresso")}</div>
    <button type="button" class="nav-button nav-more ${moreActive ? "active" : ""}"
      aria-expanded="false" aria-controls="navGroups" onclick="toggleMoreNav(this)"><span aria-hidden="true">☰</span>Mais</button>
    <div id="navGroups" class="nav-groups">${groups.map(([label, names], index) => `
      <section class="nav-group" aria-labelledby="navGroup${index}">
        <h2 id="navGroup${index}" class="nav-group-label">${label}</h2>
        ${names.map(button).join("")}
      </section>`).join("")}<div class="nav-mobile-account"><button type="button" class="nav-button danger" onclick="document.getElementById('logoutBtn').click()"><span aria-hidden="true">↪</span>Sair e voltar ao login</button></div></div>`;
  mlUpdateChatUnreadBadge(Number(document.documentElement.dataset.chatUnread || 0));
}

function toggleMoreNav(button) {
  const expanded = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(expanded));
  $("#navGroups").classList.toggle("is-open", expanded);
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    const button = document.querySelector('.nav-more[aria-expanded="true"]');
    if (button) { toggleMoreNav(button); button.focus(); }
  }
});
document.addEventListener("click", event => {
  if (!event.target.closest("#mainNav")) {
    const button = document.querySelector('.nav-more[aria-expanded="true"]');
    if (button) toggleMoreNav(button);
  }
});

function show(page) {
  if (currentPage === "Chats" && page !== "Chats" && typeof mlStopChatPolling === "function") {
    mlStopChatPolling();
  }
  currentPage = page;

  clearCharts();

  $("#pageTitle").textContent = page;

  renderNav();

  const pages = {
    "Meu Dia": renderToday,
    "Metas": renderGoals,
    "Treino": renderWorkout,
    "Dieta": renderDiet,
    "Hábitos": renderHabits,
    "Peso & Progresso": renderWeight,
    "Trabalho & Tarefas": renderTasks,
    "Meu Progresso": renderInsights,
    "Pessoas": renderPeople,
    "Desafios": renderChallenges,
    "Chats": renderChats
  };

  (pages[page] || renderToday)();
}

/* =========================
   COMPONENTES
========================= */

function progress(label, value, target, unit = "") {
  return `
    <div class="card">
      <div class="metric-row">
        <div>
          <div class="metric-label">${label}</div>
          <div class="big">${value}${unit}</div>
        </div>

        <div class="pill">
          ${pct(value, target)}%
        </div>
      </div>

      <div class="progress">
        <span style="width:${pct(value, target)}%"></span>
      </div>
    </div>
  `;
}

function ensureDailyArray() {
  if (Array.isArray(state.daily)) {
    return state.daily;
  }

  // Compatibilidade com versões anteriores, que salvavam os itens
  // agrupados por data: { "2026-09-04": [ ... ] }.
  if (state.daily && typeof state.daily === "object") {
    state.daily = Object.entries(state.daily).flatMap(
      ([date, items]) =>
        Array.isArray(items)
          ? items.map(item => ({
              ...item,
              date: normalizeDate(item.date || date)
            }))
          : []
    );
  } else {
    state.daily = [];
  }

  return state.daily;
}

function dayItems() {
  const today = iso();

  return ensureDailyArray().filter(
    item => normalizeDate(item.date) === today
  );
}

/* =========================
   MEU DIA
========================= */

function renderToday() {
  const items = dayItems();

  const score = items.length
    ? Math.round(
        items.reduce(
          (sum, item) => sum + pct(item.value, item.target),
          0
        ) / items.length
      )
    : 0;

  $("#content").innerHTML = `
    <div class="grid cols-4">

      <div class="card">
        <div
          class="score-ring"
          style="--p:${score}"
        >
          <strong>${score}%</strong>
          <small>do dia</small>
        </div>
      </div>

      ${progress(
        "Dieta",
        items.find(x => x.category === "Dieta")?.value || 0,
        items.find(x => x.category === "Dieta")?.target || 5,
        "/5"
      )}

      ${progress(
        "Cardio",
        items.find(x => x.category === "Cardio")?.value || 0,
        items.find(x => x.category === "Cardio")?.target || 30,
        " min"
      )}

      ${progress(
        "Trabalho",
        items.find(x => x.category === "Trabalho")?.value || 0,
        items.find(x => x.category === "Trabalho")?.target || 4,
        " h"
      )}
    </div>

    <div class="section-head">
      <h2>Hoje</h2>

      <button
        class="chip-btn"
        onclick="openQuickAdd()"
      >
        + adicionar
      </button>
    </div>

    <div class="timeline">
      ${
        items.length
          ? items.map(item => `
            <div
              class="timeline-item ${
                pct(item.value, item.target) >= 100
                  ? "done"
                  : ""
              }"
            >
              <button
                class="check"
                onclick="toggleDaily('${item.id}')"
              >
                ${
                  pct(item.value, item.target) >= 100
                    ? "✓"
                    : ""
                }
              </button>

            <div>
                <div class="timeline-title">
                ${item.title}
            </div>

            ${
                item.goal_id
                ? `
                    <div
                    class="muted"
                    style="
                        margin-top:3px;
                        font-size:11px
                    "
                    >
                    🎯 ${
                        state.goals
                        ?.find(
                            g =>
                            g.id ===
                            item.goal_id
                        )
                        ?.name ||
                        "Meta"
                    }
                    </div>
                `
                : ""
            }

            <div class="muted">
              ${item.value || 0} / ${item.target || 0} ${item.unit || ""}
             </div>
            </div>

                <div class="muted">
                  ${item.category}
                  ·
                  ${item.value}/${item.target}
                  ${item.unit || ""}
                </div>
              </div>

              <span class="pill">
                ${pct(item.value, item.target)}%
              </span>
            </div>
          `).join("")
          : `
            <div class="card muted">
              Nenhum item cadastrado para hoje.
            </div>
          `
      }
    </div>

    <div class="section-head">
      <h2>Sequência & XP</h2>
    </div>

    <div class="grid cols-3">

      <div class="card">
        <div class="metric-label">
          Sequência atual
        </div>

        <div class="big">
          🔥 ${state.user?.streak || 0} dias
        </div>
      </div>

      <div class="card">
        <div class="metric-label">
          Nível
        </div>

        <div class="big">
          ${state.user?.level || 1}
        </div>
      </div>

      <div class="card">
        <div class="metric-label">
          XP total
        </div>

        <div class="big">
          ${state.user?.xp || 0}
        </div>
      </div>

    </div>
  `;
}

async function toggleDaily(id) {
  const item = dayItems().find(item => item.id === id);

  if (!item) return;

  item.value =
    item.value >= item.target
      ? 0
      : item.target;

  item.done =
    item.value >= item.target;

  saveLocal();

  if (isLogged()) {
    await api("saveDaily", {
      item: {
        ...item,
        date: iso()
      }
    });
  }

  renderToday();
}

/* =========================
   ADICIONAR ITEM DO DIA
========================= */

function openQuickAdd() {
  openModal(
    "Adicionar ao dia",
    `
      <div class="form-grid">

        <div class="field">
          <label>Categoria</label>

          <select id="qCat">
            <option>Dieta</option>
            <option>Treino</option>
            <option>Cardio</option>
            <option>Trabalho</option>
            <option>Tarefas</option>
            <option>Outro</option>
          </select>
        </div>

        <div class="field">
          <label>Título</label>
          <input id="qTitle">
        </div>

        <div class="field">
          <label>Meta</label>

          <input
            id="qTarget"
            type="number"
            step="0.1"
          >
        </div>

        <div class="field">
          <label>Unidade</label>

          <input
            id="qUnit"
            placeholder="min, h, itens..."
          >
        </div>

      </div>

      <button
        class="primary"
        onclick="addDaily()"
      >
        Adicionar
      </button>
    `
  );
}

async function addDaily() {
  const item = {
    id: uid(),
    date: iso(),
    category: $("#qCat").value,
    title: $("#qTitle").value || "Nova atividade",
    target: +$("#qTarget").value || 1,
    value: 0,
    unit: $("#qUnit").value || "",
    done: false
  };

  ensureDailyArray().push(item);

  saveLocal();

  if (isLogged()) {
    const response = await api("saveDaily", {
      item
    });

    if (response?.ok) {
      toast("Atividade salva.");
    }
  }

  closeModal();
  renderToday();
}

/* =========================
   METAS
========================= */

function renderGoals() {
  const goals = Array.isArray(state.goals) ? state.goals : [];

  $("#content").innerHTML = `
    <div class="section-head">
      <div>
        <h2>Suas metas</h2>
        <div class="muted">Objetivos conectados ao seu plano diário.</div>
      </div>
      <button class="primary" onclick="goalModal()">+ Nova meta</button>
    </div>

    ${goals.length ? `
      <div class="grid cols-2">
        ${goals.map(goal => {
          const goalProgress = calculateGoalProgress(goal);
          const status = calculateGoalStatus(goal);
          const linked = goal.trackingMode === "daily";

          return `
            <div class="card goal-card">
              <div class="goal-top">
                <div>
                  <div class="goal-title">${goal.name}</div>
                  <div class="goal-meta">${goal.category || "Sem categoria"}</div>
                </div>
                <span class="badge">${status.text}</span>
              </div>

              <div class="kpi">
                <div>
                  <div class="metric-label">Atual</div>
                  <strong>${goal.currentValue ?? 0} ${goal.unit || ""}</strong>
                </div>
                <div style="text-align:right">
                  <div class="metric-label">Meta</div>
                  <strong>${goal.targetValue ?? 0} ${goal.unit || ""}</strong>
                </div>
              </div>

              <div class="progress"><span style="width:${goalProgress}%"></span></div>

              <div style="display:flex;justify-content:space-between;margin-top:10px;gap:10px">
                <span class="muted">${goalProgress}% concluído</span>
                ${goal.deadline ? `<span class="muted">até ${new Date(goal.deadline + "T12:00").toLocaleDateString("pt-BR")}</span>` : ""}
              </div>

              ${linked ? `
                <div style="margin-top:18px;padding:14px;border-radius:14px;background:#f8fafc">
                  <div class="metric-label">Plano diário</div>
                  <div style="font-weight:700;margin-top:6px">${goal.plan?.title || goal.name}</div>
                  <div class="muted" style="margin-top:4px">
                    ${goal.plan?.target || 1} ${goal.plan?.unit || ""}
                    ${goal.plan?.time ? " · " + goal.plan.time : ""}
                  </div>
                </div>
              ` : ""}

              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
                <button class="chip-btn" onclick="goalModal('${goal.id}')">Editar</button>
                <button class="chip-btn danger" onclick="deleteGoalItem('${goal.id}')">Excluir</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `
      <div class="card">
        <h3>Nenhuma meta criada</h3>
        <div class="muted">Crie sua primeira meta e transforme-a em ações no Meu Dia.</div>
      </div>
    `}
  `;
}

function goalModal(goalId = null) {
  const goal = (state.goals || []).find(item => item.id === goalId) || null;
  const editing = !!goal;
  const trackingMode = goal?.trackingMode || "manual";

  openModal(
    editing ? "Editar meta" : "Nova meta",
    `
      <input type="hidden" id="goalEditId" value="${goal?.id || ""}">

      <div class="form-grid">
        <div class="field">
          <label>Nome da meta</label>
          <input id="goalName" value="${goal?.name || ""}" placeholder="Ex.: Chegar a 80 kg">
        </div>

        <div class="field">
          <label>Categoria</label>
          <select id="goalCategory">
            ${["Saúde","Treino","Dieta","Trabalho","Financeiro","Estudos","Pessoal","Outro"].map(category => `
              <option ${goal?.category === category ? "selected" : ""}>${category}</option>
            `).join("")}
          </select>
        </div>

        <div class="field">
          <label>Valor inicial</label>
          <input id="goalStartValue" type="number" step="0.01" value="${goal?.startValue ?? ""}">
        </div>

        <div class="field">
          <label>Valor atual</label>
          <input id="goalCurrentValue" type="number" step="0.01" value="${goal?.currentValue ?? ""}">
        </div>

        <div class="field">
          <label>Valor alvo</label>
          <input id="goalTargetValue" type="number" step="0.01" value="${goal?.targetValue ?? ""}">
        </div>

        <div class="field">
          <label>Unidade</label>
          <input id="goalUnit" value="${goal?.unit || ""}" placeholder="kg, R$, horas...">
        </div>

        <div class="field">
          <label>Data de início</label>
          <input id="goalStartDate" type="date" value="${goal?.startDate || iso()}">
        </div>

        <div class="field">
          <label>Prazo final</label>
          <input id="goalDeadline" type="date" value="${goal?.deadline || ""}">
        </div>
      </div>

      <div class="card" style="margin:20px 0">
        <div class="section-head" style="margin-top:0">
          <div>
            <h2>Acompanhamento</h2>
            <div class="muted">Faça essa meta gerar ações automaticamente no Meu Dia.</div>
          </div>
        </div>

        <div class="field">
          <label>Como deseja acompanhar?</label>
          <select id="goalTrackingMode" onchange="toggleGoalTrackingFields()">
            <option value="manual" ${trackingMode === "manual" ? "selected" : ""}>Manualmente</option>
            <option value="daily" ${trackingMode === "daily" ? "selected" : ""}>Pelo Meu Dia</option>
          </select>
        </div>

        <div id="goalTrackingFields" style="display:${trackingMode === "daily" ? "block" : "none"};margin-top:16px">
          <div class="form-grid">
            <div class="field">
              <label>Frequência</label>
              <select id="goalFrequency">
                <option value="daily" ${goal?.plan?.frequency === "daily" ? "selected" : ""}>Todos os dias</option>
                <option value="weekdays" ${goal?.plan?.frequency === "weekdays" ? "selected" : ""}>Segunda a sexta</option>
                <option value="weekends" ${goal?.plan?.frequency === "weekends" ? "selected" : ""}>Sábado e domingo</option>
              </select>
            </div>

            <div class="field">
              <label>Horário</label>
              <input id="goalDailyTime" type="time" value="${goal?.plan?.time || ""}">
            </div>

            <div class="field">
              <label>Ação no Meu Dia</label>
              <input id="goalDailyTitle" value="${goal?.plan?.title || ""}" placeholder="Ex.: Fazer 30 minutos de cardio">
            </div>

            <div class="field">
              <label>Meta diária</label>
              <input id="goalDailyTarget" type="number" step="0.01" value="${goal?.plan?.target ?? ""}">
            </div>

            <div class="field">
              <label>Unidade diária</label>
              <input id="goalDailyUnit" value="${goal?.plan?.unit || ""}" placeholder="minutos, litros, páginas...">
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="primary" onclick="saveGoalForm()">${editing ? "Salvar alterações" : "Criar meta"}</button>
        ${editing ? `<button class="secondary" onclick="deleteGoalItem('${goal.id}')">Excluir meta</button>` : ""}
      </div>
    `
  );
}

async function saveGoalForm() {
  const id = $("#goalEditId").value || uid();
  const existing = (state.goals || []).find(item => item.id === id);
  const name = $("#goalName").value.trim();

  if (!name) {
    toast("Informe o nome da meta.");
    return;
  }

  const trackingMode = $("#goalTrackingMode").value;
  const oldPlanId = existing?.plan?.id;

  const goal = {
    ...(existing || {}),
    id,
    name,
    category: $("#goalCategory").value,
    startValue: Number($("#goalStartValue").value) || 0,
    currentValue: Number($("#goalCurrentValue").value) || 0,
    targetValue: Number($("#goalTargetValue").value) || 0,
    unit: $("#goalUnit").value.trim(),
    startDate: $("#goalStartDate").value || iso(),
    deadline: $("#goalDeadline").value,
    trackingMode,
    plan: {
      id: oldPlanId || "PLAN_" + id,
      frequency: trackingMode === "daily" ? $("#goalFrequency").value : null,
      title: trackingMode === "daily" ? $("#goalDailyTitle").value.trim() : "",
      target: trackingMode === "daily" ? Number($("#goalDailyTarget").value) || 1 : 0,
      unit: trackingMode === "daily" ? $("#goalDailyUnit").value.trim() : "",
      time: trackingMode === "daily" ? $("#goalDailyTime").value : ""
    },
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.goals = Array.isArray(state.goals) ? state.goals : [];
  const index = state.goals.findIndex(item => item.id === id);
  if (index >= 0) state.goals[index] = goal;
  else state.goals.push(goal);

  // Atualiza a ação de hoje já vinculada à meta editada.
  const daily = ensureDailyArray();
  daily.forEach(item => {
    if (item.goal_id === id && item.plan_id === goal.plan.id && normalizeDate(item.date) === iso()) {
      item.category = goal.category || "Meta";
      item.title = goal.plan.title || goal.name;
      item.target = Number(goal.plan.target) || 1;
      item.unit = goal.plan.unit || "";
      item.time = goal.plan.time || "";
    }
  });

  saveLocal();

  if (isLogged()) {
    const response = await api("saveGoal", { item: goal });
    if (!response?.ok) {
      toast(response?.error || "Erro ao salvar a meta.");
      return;
    }

    for (const item of daily.filter(item => item.goal_id === id && normalizeDate(item.date) === iso())) {
      await api("saveDaily", { item });
    }
  }

  await ensureGoalDailyItems();
  closeModal();
  renderGoals();
  toast(existing ? "Meta atualizada." : "Meta criada.");
}

async function deleteGoalItem(id) {
  const goal = (state.goals || []).find(item => item.id === id);
  if (!goal) return;

  if (!confirm(`Excluir a meta "${goal.name}"?`)) return;

  state.goals = (state.goals || []).filter(item => item.id !== id);
  state.daily = ensureDailyArray().filter(item => item.goal_id !== id);
  saveLocal();

  if (isLogged()) {
    const response = await api("deleteGoal", { id });
    if (!response?.ok) {
      console.warn("Não foi possível excluir a meta no servidor:", response);
    }
  }

  closeModal();
  renderGoals();
  toast("Meta excluída.");
}

function calculateGoalProgress(goal) {
  const start =
    Number(
      goal.startValue
    ) || 0;

  const current =
    Number(
      goal.currentValue
    ) || 0;

  const target =
    Number(
      goal.targetValue
    ) || 0;

  if (start === target) {
    return 100;
  }

  let progress;

  /*
    Meta decrescente:
    exemplo 90 → 80
  */
  if (target < start) {
    progress =
      (
        (start - current) /
        (start - target)
      ) * 100;
  }

  /*
    Meta crescente:
    exemplo 0 → 100
  */
  else {
    progress =
      (
        (current - start) /
        (target - start)
      ) * 100;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(progress)
    )
  );
}


function calculateGoalStatus(goal) {
  const progress =
    calculateGoalProgress(
      goal
    );

  if (progress >= 100) {
    return {
      text: "Concluída",
      type: "success"
    };
  }

  if (
    !goal.startDate ||
    !goal.deadline
  ) {
    return {
      text: "Em andamento",
      type: "normal"
    };
  }

  const start =
    new Date(
      goal.startDate + "T12:00"
    );

  const deadline =
    new Date(
      goal.deadline + "T12:00"
    );

  const today =
    new Date();

  const total =
    deadline - start;

  const passed =
    today - start;

  if (total <= 0) {
    return {
      text: "Em andamento",
      type: "normal"
    };
  }

  const expected =
    Math.max(
      0,
      Math.min(
        100,
        (
          passed /
          total
        ) * 100
      )
    );

  if (
    progress >=
    expected + 5
  ) {
    return {
      text: "Adiantado",
      type: "success"
    };
  }

  if (
    progress <
    expected - 5
  ) {
    return {
      text: "Atrasado",
      type: "warning"
    };
  }

  return {
    text: "No ritmo",
    type: "normal"
  };
}

function toggleGoalTrackingFields() {
  const mode =
    $("#goalTrackingMode").value;

  $("#goalTrackingFields").style.display =
    mode === "daily"
      ? "block"
      : "none";
}

async function addGoal() {
  const name =
    $("#goalName").value.trim();

  if (!name) {
    toast("Informe o nome da meta.");
    return;
  }

  const trackingMode =
    $("#goalTrackingMode").value;

  const goalId = uid();

  const goal = {
    id: goalId,

    name,

    category:
      $("#goalCategory").value,

    startValue:
      Number(
        $("#goalStartValue").value
      ) || 0,

    currentValue:
      Number(
        $("#goalCurrentValue").value
      ) || 0,

    targetValue:
      Number(
        $("#goalTargetValue").value
      ) || 0,

    unit:
      $("#goalUnit").value.trim(),

    startDate:
      $("#goalStartDate").value ||
      iso(),

    deadline:
      $("#goalDeadline").value,

    trackingMode,

    plan: {
      id: "PLAN_" + goalId,

      frequency:
        trackingMode === "daily"
          ? $("#goalFrequency").value
          : null,

      title:
        trackingMode === "daily"
          ? $("#goalDailyTitle").value.trim()
          : "",

      target:
        trackingMode === "daily"
          ? Number(
              $("#goalDailyTarget").value
            ) || 1
          : 0,

      unit:
        trackingMode === "daily"
          ? $("#goalDailyUnit").value.trim()
          : "",

      time:
        trackingMode === "daily"
          ? $("#goalDailyTime").value
          : ""
    },

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };

  state.goals ||= [];

  state.goals.push(goal);

  saveLocal();

  if (isLogged()) {
    const response =
      await api(
        "saveGoal",
        {
          item: goal
        }
      );

    if (!response.ok) {
      toast(
        response.error ||
        "Erro ao salvar a meta."
      );
      return;
    }
  }

  await ensureGoalDailyItems();

  closeModal();

  renderGoals();

  toast("Meta criada.");
}

function shouldCreateGoalActionToday(goal) {
  if (
    !goal ||
    goal.trackingMode !== "daily" ||
    !goal.plan
  ) {
    return false;
  }

  const today =
    new Date();

  const day =
    today.getDay();

  const frequency =
    goal.plan.frequency;

  if (frequency === "daily") {
    return true;
  }

  if (frequency === "weekdays") {
    return day >= 1 && day <= 5;
  }

  if (frequency === "weekends") {
    return day === 0 || day === 6;
  }

  return false;
}

async function ensureGoalDailyItems() {
  const daily = ensureDailyArray();
  const today = iso();

  const goals = Array.isArray(state.goals)
    ? state.goals
    : [];

  for (const goal of goals) {
    if (!shouldCreateGoalActionToday(goal)) {
      continue;
    }

    if (
      goal.startDate &&
      today < normalizeDate(goal.startDate)
    ) {
      continue;
    }

    if (
      goal.deadline &&
      today > normalizeDate(goal.deadline)
    ) {
      continue;
    }

    const planId = goal.plan?.id || `PLAN_${goal.id}`;

    const existing = daily.find(
      item =>
        normalizeDate(item.date) === today &&
        item.goal_id === goal.id &&
        item.plan_id === planId
    );

    if (existing) {
      continue;
    }

    const dailyItem = {
      id: uid(),
      date: today,
      category: goal.category || "Meta",
      title: goal.plan?.title || goal.name,
      target: Number(goal.plan?.target) || 1,
      value: 0,
      unit: goal.plan?.unit || "",
      time: goal.plan?.time || "",
      done: false,
      goal_id: goal.id,
      plan_id: planId,
      source: "goal",
      createdAt: new Date().toISOString()
    };

    daily.push(dailyItem);

    if (isLogged()) {
      await api("saveDaily", {
        item: dailyItem
      });
    }
  }

  saveLocal();
}

/* =========================
   PESO
========================= */

function renderWeight() {
  const weight = state.weight || [];

  const labels = weight.map(item =>
    new Date(
      normalizeDate(item.date) + "T12:00"
    ).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit"
    })
  );

  const data =
    weight.map(item => +item.value);

  const goal =
    (state.goals || []).find(
      item => item.category === "Peso"
    );

  $("#content").innerHTML = `
    <div class="grid cols-3">

      <div class="card">
        <div class="metric-label">
          Peso atual
        </div>

        <div class="big">
          ${data.at(-1) || "-"} kg
        </div>
      </div>

      <div class="card">
        <div class="metric-label">
          Meta
        </div>

        <div class="big">
          ${goal?.target ?? "-"} kg
        </div>
      </div>

      <div class="card">
        <div class="metric-label">
          Faltam
        </div>

        <div class="big">
          ${
            goal && data.length
              ? Math.max(
                  0,
                  data.at(-1) - goal.target
                ).toFixed(1)
              : "-"
          } kg
        </div>
      </div>

    </div>

    <div class="section-head">
      <h2>Evolução</h2>

      <button
        class="chip-btn"
        onclick="weightModal()"
      >
        + registrar peso
      </button>
    </div>

    <div class="card">
      <canvas id="weightChart"></canvas>
    </div>
  `;

  setTimeout(() => {
    if (!$("#weightChart")) return;

    let planned = [];

    if (goal && labels.length > 0) {
      planned = labels.map((_, index) => {
        if (labels.length === 1) {
          return goal.start;
        }

        const fraction =
          index / (labels.length - 1);

        return (
          goal.start +
          (goal.target - goal.start) *
          fraction
        );
      });
    }

    const datasets = [
      {
        label: "Peso real",
        data
      }
    ];

    if (goal) {
      datasets.push({
        label: "Linha planejada",
        data: planned,
        borderDash: [6, 6]
      });
    }

    const chart =
      new Chart(
        $("#weightChart"),
        {
          type: "line",

          data: {
            labels,
            datasets
          },

          options: {
            responsive: true,

            plugins: {
              legend: {
                position: "bottom"
              }
            }
          }
        }
      );

    charts.push(chart);

  }, 0);
}

function weightModal() {
  openModal(
    "Registrar peso",
    `
      <div class="field">
        <label>Peso (kg)</label>

        <input
          id="wValue"
          type="number"
          step="0.1"
        >
      </div>

      <button
        class="primary"
        onclick="addWeight()"
      >
        Salvar
      </button>
    `
  );
}

async function addWeight() {
  const value =
    +$("#wValue").value;

  if (!value) {
    toast("Informe o peso.");
    return;
  }

  const item = {
    id: uid(),
    date: iso(),
    value,
    category: "Peso",
    title: "Peso corporal",
    unit: "kg"
  };

  state.weight ||= [];
  state.weight.push(item);

  const goal =
    (state.goals || []).find(
      item => item.category === "Peso"
    );

  if (goal) {
    goal.current = value;
  }

  saveLocal();

  if (isLogged()) {
    await api("saveWeight", {
      item
    });
  }

  closeModal();
  renderWeight();
}

/* =========================
   TAREFAS
========================= */

function renderTasks() {
  const tasks = state.tasks || [];

  const done =
    tasks.filter(
      task => task.done
    ).length;

  $("#content").innerHTML = `
    <div class="grid cols-3">

      ${
        progress(
          "Tarefas",
          done,
          tasks.length || 1,
          "/" + tasks.length
        )
      }

      <div class="card">
        <div class="metric-label">
          Produtividade
        </div>

        <div class="big">
          ${
            tasks.length
              ? pct(done, tasks.length)
              : 0
          }%
        </div>
      </div>

      <div class="card">
        <div class="metric-label">
          Prioridade alta pendente
        </div>

        <div class="big">
          ${
            tasks.filter(
              task =>
                !task.done &&
                +task.priority === 1
            ).length
          }
        </div>
      </div>

    </div>

    <div class="section-head">
      <h2>Hoje</h2>

      <button
        class="chip-btn"
        onclick="taskModal()"
      >
        + tarefa
      </button>
    </div>

    <div class="card">

      <table class="table">

        <thead>
          <tr>
            <th></th>
            <th>Tarefa</th>
            <th>Projeto</th>
            <th>Prioridade</th>
          </tr>
        </thead>

        <tbody>
          ${
            tasks.map(task => `
              <tr>

                <td>
                  <button
                    class="check"
                    onclick="toggleTask('${task.id}')"
                  >
                    ${task.done ? "✓" : ""}
                  </button>
                </td>

                <td>
                  ${task.title}
                </td>

                <td>
                  ${task.project || "Geral"}
                </td>

                <td>
                  P${task.priority || 3}
                </td>

              </tr>
            `).join("")
          }
        </tbody>

      </table>

    </div>
  `;
}

function taskModal() {
  openModal(
    "Nova tarefa",
    `
      <div class="field">
        <label>Tarefa</label>
        <input id="tTitle">
      </div>

      <div class="field">
        <label>Projeto</label>
        <input id="tProject">
      </div>

      <div class="field">
        <label>Prioridade</label>

        <select id="tPriority">
          <option value="1">Alta</option>
          <option value="2">Média</option>
          <option value="3">Baixa</option>
        </select>
      </div>

      <button
        class="primary"
        onclick="addTask()"
      >
        Salvar
      </button>
    `
  );
}

async function addTask() {
  const item = {
    id: uid(),
    date: iso(),
    title:
      $("#tTitle").value ||
      "Nova tarefa",
    project:
      $("#tProject").value ||
      "Geral",
    priority:
      +$("#tPriority").value,
    category: "Tarefa",
    value: 0,
    target: 1,
    done: false
  };

  state.tasks ||= [];
  state.tasks.push(item);

  saveLocal();

  if (isLogged()) {
    await api("saveTask", {
      item
    });
  }

  closeModal();
  renderTasks();
}

async function toggleTask(id) {
  const task =
    (state.tasks || []).find(
      item => item.id === id
    );

  if (!task) return;

  task.done = !task.done;
  task.value = task.done ? 1 : 0;

  saveLocal();

  if (isLogged()) {
    await api("saveTask", {
      item: task
    });
  }

  renderTasks();
}

/* =========================
   TREINO
========================= */

function createWorkoutModal() {
  openModal(
    "Criar treino",
    `
      <div class="form-grid">
        <div class="field">
          <label>Nome do treino</label>
          <input id="workoutName" placeholder="Ex.: Treino A — Peito e Tríceps">
        </div>
        <div class="field">
          <label>Data</label>
          <input id="workoutCreateDate" type="date" value="${iso()}">
        </div>
        <div class="field">
          <label>Horário de início</label>
          <input id="workoutCreateTime" type="time">
        </div>
      </div>
      <button class="primary" onclick="createWorkout()">Criar treino</button>
    `
  );
}

async function createWorkout() {
  const name = $("#workoutName").value.trim();
  if (!name) {
    toast("Informe o nome do treino.");
    return;
  }

  const workout = {
    id: uid(),
    name,
    date: $("#workoutCreateDate").value || iso(),
    startTime: $("#workoutCreateTime").value || "",
    endTime: "",
    finished: false,
    exercises: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.workouts = Array.isArray(state.workouts) ? state.workouts : [];
  state.workouts.unshift(workout);
  saveLocal();

  if (isLogged()) {
    const response = await api("saveWorkout", { item: workout });
    if (!response?.ok) {
      toast(response?.error || "Erro ao salvar o treino.");
      return;
    }
  }

  closeModal();
  renderWorkout();
  toast("Treino criado.");
}

function editWorkoutModal() {
  const workout = state.workouts?.[0];
  if (!workout) return;

  openModal(
    "Editar treino",
    `
      <div class="form-grid">
        <div class="field">
          <label>Nome do treino</label>
          <input id="editWorkoutName" value="${workout.name || ""}">
        </div>
        <div class="field">
          <label>Data</label>
          <input id="editWorkoutDate" type="date" value="${workout.date || iso()}">
        </div>
        <div class="field">
          <label>Início</label>
          <input id="editWorkoutStart" type="time" value="${workout.startTime || ""}">
        </div>
        <div class="field">
          <label>Término</label>
          <input id="editWorkoutEnd" type="time" value="${workout.endTime || ""}">
        </div>
      </div>
      <button class="primary" onclick="saveWorkoutEdit()">Salvar alterações</button>
    `
  );
}

async function saveWorkoutEdit() {
  const workout = state.workouts?.[0];
  if (!workout) return;

  workout.name = $("#editWorkoutName").value.trim() || workout.name;
  workout.date = $("#editWorkoutDate").value || iso();
  workout.startTime = $("#editWorkoutStart").value || "";
  workout.endTime = $("#editWorkoutEnd").value || "";
  workout.updatedAt = new Date().toISOString();
  saveLocal();

  if (isLogged()) await api("saveWorkout", { item: workout });

  closeModal();
  renderWorkout();
  toast("Treino atualizado.");
}

async function deleteWorkoutItem() {
  const workout = state.workouts?.[0];
  if (!workout) return;
  if (!confirm(`Excluir o treino "${workout.name}"?`)) return;

  state.workouts = (state.workouts || []).filter(item => item.id !== workout.id);
  saveLocal();

  if (isLogged()) {
    const response = await api("deleteWorkout", { id: workout.id });
    if (!response?.ok) console.warn("Erro ao excluir treino no servidor:", response);
  }

  closeModal();
  renderWorkout();
  toast("Treino excluído.");
}

function editExerciseModal(exerciseIndex) {
  const exercise = state.workouts?.[0]?.exercises?.[exerciseIndex];
  if (!exercise) return;

  openModal(
    "Editar exercício",
    `
      <div class="field">
        <label>Nome do exercício</label>
        <input id="editExerciseName" value="${exercise.name || ""}">
      </div>
      <button class="primary" onclick="saveExerciseEdit(${exerciseIndex})">Salvar</button>
    `
  );
}

async function saveExerciseEdit(exerciseIndex) {
  const workout = state.workouts?.[0];
  const exercise = workout?.exercises?.[exerciseIndex];
  if (!exercise) return;

  exercise.name = $("#editExerciseName").value.trim() || exercise.name;
  workout.updatedAt = new Date().toISOString();
  saveLocal();
  if (isLogged()) await api("saveWorkout", { item: workout });

  closeModal();
  renderWorkout();
  toast("Exercício atualizado.");
}

async function deleteExercise(exerciseIndex) {
  const workout = state.workouts?.[0];
  const exercise = workout?.exercises?.[exerciseIndex];
  if (!exercise) return;
  if (!confirm(`Excluir o exercício "${exercise.name}"?`)) return;

  workout.exercises.splice(exerciseIndex, 1);
  workout.updatedAt = new Date().toISOString();
  saveLocal();
  if (isLogged()) await api("saveWorkout", { item: workout });

  renderWorkout();
  toast("Exercício excluído.");
}

function renderWorkout() {
  const workout = state.workouts?.[0];

  if (!workout) {
    $("#content").innerHTML = `
      <div class="card">
        <div class="section-head">
          <h2>Nenhum treino configurado</h2>

          <button
            class="chip-btn"
            onclick="createWorkoutModal()"
          >
            + Criar treino
          </button>
        </div>
      </div>
    `;

    return;
  }

  const totalSets =
    workout.exercises.reduce(
      (total, exercise) =>
        total + exercise.sets.length,
      0
    );

  const doneSets =
    workout.exercises.reduce(
      (total, exercise) =>
        total +
        exercise.sets.filter(
          set => set.done
        ).length,
      0
    );

  const volume =
    workout.exercises.reduce(
      (total, exercise) =>
        total +
        exercise.sets.reduce(
          (sum, set) =>
            sum +
            (
              set.done
                ? Number(set.kg || 0) *
                  Number(set.reps || 0)
                : 0
            ),
          0
        ),
      0
    );

  $("#content").innerHTML = `
    <div class="grid cols-3">

      <div class="card">
        <div class="metric-label">
          Horário do treino
        </div>

        <div class="big">
          ${workout.startTime || "--:--"}
        </div>

        <button
          class="chip-btn"
          onclick="workoutTimeModal()"
          style="margin-top:12px"
        >
          Alterar horário
        </button>
      </div>

      <div class="card">
        <div class="metric-label">
          Séries concluídas
        </div>

        <div class="big">
          ${doneSets}/${totalSets}
        </div>

        <div class="progress">
          <span
            style="width:${
              totalSets
                ? Math.round(
                    doneSets /
                    totalSets *
                    100
                  )
                : 0
            }%"
          ></span>
        </div>
      </div>

      <div class="card">
        <div class="metric-label">
          Volume do treino
        </div>

        <div class="big">
          ${volume.toLocaleString("pt-BR")} kg
        </div>

        <div class="muted">
          carga × repetições
        </div>
      </div>

    </div>

    <div class="section-head">
      <div>
        <h2>${workout.name}</h2>

        <div class="muted">
          ${workout.date || iso()}
          ·
          início ${workout.startTime || "--:--"}
        </div>
      </div>

      <div style="
        display:flex;
        gap:8px;
        flex-wrap:wrap
      ">

        <button class="chip-btn" onclick="editWorkoutModal()">Editar treino</button>

        <button class="chip-btn" onclick="addExerciseModal()">+ Exercício</button>

        <button class="chip-btn good" onclick="finishWorkout()">Finalizar treino</button>

        <button class="chip-btn danger" onclick="deleteWorkoutItem()">Excluir treino</button>

      </div>
    </div>

    ${
      workout.exercises.map(
        (exercise, ei) => {

          const maxKg =
            Math.max(
              0,
              ...exercise.sets.map(
                set =>
                  Number(set.kg || 0)
              )
            );

          const previousKg =
            getPreviousExerciseLoad(
              exercise
            );

          const variation =
            previousKg
              ? maxKg - previousKg
              : 0;

          return `
            <div class="card" style="margin-bottom:18px">

              <div class="goal-top">

                <div>
                  <h3>
                    ${exercise.name}
                  </h3>

                  <div class="muted">
                    Maior carga atual:
                    <b>${maxKg} kg</b>

                    ${
                      previousKg
                        ? `
                          · anterior:
                          ${previousKg} kg
                        `
                        : ""
                    }
                  </div>
                </div>

                <div style="
                  display:flex;
                  gap:8px;
                  flex-wrap:wrap
                ">

                  ${
                    previousKg
                      ? `
                        <span
                          class="badge"
                        >
                          ${
                            variation > 0
                              ? "▲"
                              : variation < 0
                              ? "▼"
                              : "="
                          }

                          ${variation >= 0 ? "+" : ""}
                          ${variation} kg
                        </span>
                      `
                      : ""
                  }

                  <button
                    class="chip-btn"
                    onclick="
                      showExerciseProgress(
                        ${ei}
                      )
                    "
                  >
                    Ver progressão
                  </button>

                  <button class="chip-btn" onclick="editExerciseModal(${ei})">Editar exercício</button>

                  <button class="chip-btn" onclick="addWorkoutSet(${ei})">+ Série</button>

                  <button class="chip-btn danger" onclick="deleteExercise(${ei})">Excluir exercício</button>

                </div>

              </div>

              <div class="workout-table-wrap">

                <table class="table">

                  <thead>
                    <tr>
                      <th>Série</th>
                      <th>Carga</th>
                      <th>Reps</th>
                      <th>Volume</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>

                    ${
                      exercise.sets
                        .map(
                          (set, si) => `
                            <tr>

                              <td>
                                ${si + 1}
                              </td>

                              <td>
                                <div
                                  style="
                                    display:flex;
                                    align-items:center;
                                    gap:6px
                                  "
                                >
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value="${set.kg}"
                                    onchange="
                                      setWorkout(
                                        ${ei},
                                        ${si},
                                        'kg',
                                        this.value
                                      )
                                    "
                                    style="max-width:90px"
                                  >
                                  <span class="muted">
                                    kg
                                  </span>
                                </div>
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  value="${set.reps}"
                                  onchange="
                                    setWorkout(
                                      ${ei},
                                      ${si},
                                      'reps',
                                      this.value
                                    )
                                  "
                                  style="max-width:90px"
                                >
                              </td>

                              <td>
                                ${
                                  (
                                    Number(set.kg || 0) *
                                    Number(set.reps || 0)
                                  ).toLocaleString("pt-BR")
                                }
                                kg
                              </td>

                              <td>
                                <button
                                  class="chip-btn ${
                                    set.done
                                      ? "good"
                                      : ""
                                  }"
                                  onclick="
                                    toggleSet(
                                      ${ei},
                                      ${si}
                                    )
                                  "
                                >
                                  ${
                                    set.done
                                      ? "✓ Concluída"
                                      : "Marcar"
                                  }
                                </button>
                              </td>

                            </tr>
                          `
                        )
                        .join("")
                    }

                  </tbody>

                </table>

              </div>

            </div>
          `;
        }
      ).join("")
    }
  `;
}

function getPreviousExerciseLoad(exercise) {
  const history =
    exercise.history || [];

  if (!history.length) {
    return null;
  }

  const sorted =
    [...history].sort(
      (a, b) =>
        new Date(a.date) -
        new Date(b.date)
    );

  if (sorted.length === 1) {
    return sorted[0].kg;
  }

  return Number(
    sorted[
      sorted.length - 2
    ].kg
  );
}

async function setWorkout(
  exerciseIndex,
  setIndex,
  key,
  value
) {
  const workout =
    state.workouts[0];

  workout
    .exercises[exerciseIndex]
    .sets[setIndex][key] =
    Number(value);

  saveLocal();

  if (isLogged()) {
    await api(
      "saveWorkout",
      {
        item: workout
      }
    );
  }
}

async function toggleSet(
  exerciseIndex,
  setIndex
) {
  const workout =
    state.workouts[0];

  const selected =
    workout
      .exercises[exerciseIndex]
      .sets[setIndex];

  selected.done =
    !selected.done;

  saveLocal();

  if (isLogged()) {
    await api(
      "saveWorkout",
      {
        item: workout
      }
    );
  }

  renderWorkout();
}

function addWorkoutSet(
  exerciseIndex
) {
  const exercise =
    state.workouts[0]
      .exercises[exerciseIndex];

  const previous =
    exercise.sets.at(-1) || {
      kg: 0,
      reps: 10
    };

  exercise.sets.push({
    kg: previous.kg,
    reps: previous.reps,
    done: false
  });

  saveLocal();

  renderWorkout();
}

function workoutTimeModal() {
  const workout =
    state.workouts[0];

  openModal(
    "Horário do treino",
    `
      <div class="form-grid">

        <div class="field">
          <label>Data</label>

          <input
            id="workoutDate"
            type="date"
            value="${
              workout.date || iso()
            }"
          >
        </div>

        <div class="field">
          <label>Horário de início</label>

          <input
            id="workoutStartTime"
            type="time"
            value="${
              workout.startTime || ""
            }"
          >
        </div>

        <div class="field">
          <label>Horário de término</label>

          <input
            id="workoutEndTime"
            type="time"
            value="${
              workout.endTime || ""
            }"
          >
        </div>

      </div>

      <button
        class="primary"
        onclick="saveWorkoutTime()"
      >
        Salvar horário
      </button>
    `
  );
}

async function saveWorkoutTime() {
  const workout =
    state.workouts[0];

  workout.date =
    $("#workoutDate").value ||
    iso();

  workout.startTime =
    $("#workoutStartTime").value ||
    "";

  workout.endTime =
    $("#workoutEndTime").value ||
    "";

  saveLocal();

  if (isLogged()) {
    await api(
      "saveWorkout",
      {
        item: workout
      }
    );
  }

  closeModal();
  renderWorkout();

  toast("Horário atualizado.");
}

function addExerciseModal() {
  openModal(
    "Adicionar exercício",
    `
      <div class="field">
        <label>Nome do exercício</label>

        <input
          id="newExerciseName"
          placeholder="Ex.: Agachamento livre"
        >
      </div>

      <div class="field">
        <label>Número de séries</label>

        <input
          id="newExerciseSets"
          type="number"
          value="3"
          min="1"
          max="10"
        >
      </div>

      <div class="field">
        <label>Carga inicial</label>

        <input
          id="newExerciseKg"
          type="number"
          value="0"
          step="0.5"
        >
      </div>

      <div class="field">
        <label>Repetições</label>

        <input
          id="newExerciseReps"
          type="number"
          value="10"
        >
      </div>

      <button
        class="primary"
        onclick="addExercise()"
      >
        Adicionar exercício
      </button>
    `
  );
}

async function addExercise() {
  const name =
    $("#newExerciseName")
      .value
      .trim();

  if (!name) {
    toast(
      "Informe o nome do exercício."
    );
    return;
  }

  const totalSets =
    Number(
      $("#newExerciseSets").value
    ) || 3;

  const kg =
    Number(
      $("#newExerciseKg").value
    ) || 0;

  const reps =
    Number(
      $("#newExerciseReps").value
    ) || 10;

  const sets =
    Array.from(
      { length: totalSets },
      () => ({
        kg,
        reps,
        done: false
      })
    );

  state.workouts[0]
    .exercises
    .push({
      id: uid(),
      name,
      sets,
      history: []
    });

  saveLocal();

  if (isLogged()) {
    await api(
      "saveWorkout",
      {
        item: state.workouts[0]
      }
    );
  }

  closeModal();
  renderWorkout();
}

function showExerciseProgress(
  exerciseIndex
) {
  const exercise =
    state.workouts[0]
      .exercises[exerciseIndex];

  const history =
    [...(exercise.history || [])]
      .sort(
        (a, b) =>
          new Date(a.date) -
          new Date(b.date)
      );

  const currentMax =
    Math.max(
      0,
      ...exercise.sets.map(
        set =>
          Number(set.kg || 0)
      )
    );

  let displayHistory =
    [...history];

  const existingToday =
    displayHistory.find(
      item =>
        item.date ===
        (
          state.workouts[0].date ||
          iso()
        )
    );

  if (!existingToday) {
    displayHistory.push({
      date:
        state.workouts[0].date ||
        iso(),
      kg: currentMax
    });
  }

  openModal(
    "Progressão — " +
      exercise.name,
    `
      <div class="grid cols-3">

        <div class="card">
          <div class="metric-label">
            Carga atual
          </div>

          <div class="big">
            ${currentMax} kg
          </div>
        </div>

        <div class="card">
          <div class="metric-label">
            Primeira carga
          </div>

          <div class="big">
            ${
              displayHistory[0]?.kg ||
              currentMax
            } kg
          </div>
        </div>

        <div class="card">
          <div class="metric-label">
            Evolução
          </div>

          <div class="big">
            ${
              (
                currentMax -
                (
                  displayHistory[0]?.kg ||
                  currentMax
                )
              ) >= 0
                ? "+"
                : ""
            }
            ${
              (
                currentMax -
                (
                  displayHistory[0]?.kg ||
                  currentMax
                )
              ).toFixed(1)
            }
            kg
          </div>
        </div>

      </div>

      <div class="card" style="margin-top:16px">
        <canvas
          id="exerciseProgressChart"
        ></canvas>
      </div>

      <div class="section-head">
        <h2 style="font-size:18px">
          Histórico
        </h2>
      </div>

      <div class="card">

        <table class="table">

          <thead>
            <tr>
              <th>Data</th>
              <th>Carga máxima</th>
            </tr>
          </thead>

          <tbody>

            ${
              displayHistory
                .slice()
                .reverse()
                .map(
                  item => `
                    <tr>
                      <td>
                        ${
                          new Date(
                            item.date +
                            "T12:00"
                          )
                            .toLocaleDateString(
                              "pt-BR"
                            )
                        }
                      </td>

                      <td>
                        ${item.kg} kg
                      </td>
                    </tr>
                  `
                )
                .join("")
            }

          </tbody>

        </table>

      </div>
    `
  );

  setTimeout(() => {
    const canvas =
      $("#exerciseProgressChart");

    if (!canvas) return;

    const chart =
      new Chart(
        canvas,
        {
          type: "line",

          data: {
            labels:
              displayHistory.map(
                item =>
                  new Date(
                    item.date +
                    "T12:00"
                  )
                    .toLocaleDateString(
                      "pt-BR",
                      {
                        day: "2-digit",
                        month: "2-digit"
                      }
                    )
              ),

            datasets: [
              {
                label: "Carga máxima (kg)",
                data:
                  displayHistory.map(
                    item =>
                      Number(item.kg)
                  ),
                tension: 0.25
              }
            ]
          },

          options: {
            responsive: true,

            scales: {
              y: {
                beginAtZero: false
              }
            },

            plugins: {
              legend: {
                position: "bottom"
              }
            }
          }
        }
      );

    charts.push(chart);

  }, 50);
}

async function finishWorkout() {
  const workout =
    state.workouts[0];

  workout.finished = true;

  workout.endTime =
    workout.endTime ||
    new Date()
      .toTimeString()
      .slice(0, 5);

  workout.exercises.forEach(
    exercise => {
      const maxKg =
        Math.max(
          0,
          ...exercise.sets
            .filter(set => set.done)
            .map(
              set =>
                Number(set.kg || 0)
            )
        );

      if (!maxKg) return;

      exercise.history ||= [];

      const today =
        workout.date ||
        iso();

      const existing =
        exercise.history.find(
          item =>
            item.date === today
        );

      if (existing) {
        existing.kg =
          maxKg;
      } else {
        exercise.history.push({
          date: today,
          kg: maxKg
        });
      }
    }
  );

  state.user.xp =
    (state.user.xp || 0) + 100;

  const daily =
    dayItems().find(
      item =>
        item.category === "Treino"
    );

  if (daily) {
    daily.value =
      daily.target;

    daily.done = true;
  }

  saveLocal();

  if (isLogged()) {
    await api(
      "saveWorkout",
      {
        item: workout
      }
    );

    if (daily) {
      await api(
        "saveDaily",
        {
          item: {
            ...daily,
            date: iso()
          }
        }
      );
    }

    await api(
      "updateProfile",
      {
        xp: state.user.xp,
        nivel:
          state.user.level || 1,
        streak:
          state.user.streak || 0
      }
    );
  }

  toast(
    "Treino concluído e cargas registradas. +100 XP"
  );

  renderWorkout();
}

/* =========================
   DIETA
========================= */

function ensureDiet() {
  if (!state.diet || state.diet.deleted) {
    state.diet = {
      id: "diet_main",
      name: "Plano alimentar",
      water: 0,
      waterTarget: 2,
      meals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  state.diet.meals = Array.isArray(state.diet.meals) ? state.diet.meals : [];
  return state.diet;
}

function renderDiet() {
  const diet = state.diet && !state.diet.deleted ? state.diet : null;

  if (!diet) {
    $("#content").innerHTML = `
      <div class="card">
        <div class="section-head" style="margin-top:0">
          <div>
            <h2>Plano alimentar não configurado</h2>
            <div class="muted">Crie sua dieta para acompanhar refeições e água.</div>
          </div>
          <button class="primary" onclick="dietModal()">+ Criar dieta</button>
        </div>
      </div>
    `;
    return;
  }

  const meals = Array.isArray(diet.meals) ? diet.meals : [];
  const done = meals.filter(meal => meal.done).length;

  $("#content").innerHTML = `
    <div class="grid cols-3">
      ${progress("Refeições", done, meals.length || 1, "/" + meals.length)}
      ${progress("Água", Number(diet.water || 0), Number(diet.waterTarget || 1), " L")}
      <div class="card">
        <div class="metric-label">Aderência do dia</div>
        <div class="big">${meals.length ? pct(done, meals.length) : 0}%</div>
      </div>
    </div>

    <div class="section-head">
      <div>
        <h2>${diet.name || "Plano alimentar"}</h2>
        <div class="muted">Meta de água: ${diet.waterTarget || 0} L</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="chip-btn" onclick="addWater()">+ 500 ml de água</button>
        <button class="chip-btn" onclick="dietModal()">Editar dieta</button>
        <button class="chip-btn" onclick="mealModal()">+ Refeição</button>
        <button class="chip-btn danger" onclick="deleteDietItem()">Excluir dieta</button>
      </div>
    </div>

    <div class="timeline">
      ${meals.length ? meals.map((meal, index) => `
        <div class="timeline-item ${meal.done ? "done" : ""}">
          <button class="check" onclick="toggleMeal(${index})">${meal.done ? "✓" : ""}</button>

          <div style="flex:1">
            <div class="timeline-title">${meal.time || "--:--"} · ${meal.title || "Refeição"}</div>
            <div class="muted">${meal.items || "Sem descrição"}</div>
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span class="pill">${meal.done ? "feito" : "pendente"}</span>
            <button class="chip-btn" onclick="mealModal(${index})">Editar</button>
            <button class="chip-btn danger" onclick="deleteMeal(${index})">Excluir</button>
          </div>
        </div>
      `).join("") : `<div class="card muted">Nenhuma refeição cadastrada.</div>`}
    </div>
  `;
}

function dietModal() {
  const existing = state.diet && !state.diet.deleted ? state.diet : null;

  openModal(
    existing ? "Editar dieta" : "Criar dieta",
    `
      <div class="form-grid">
        <div class="field">
          <label>Nome do plano</label>
          <input id="dietName" value="${existing?.name || "Plano alimentar"}">
        </div>
        <div class="field">
          <label>Meta de água (litros)</label>
          <input id="dietWaterTarget" type="number" min="0" step="0.5" value="${existing?.waterTarget ?? 2}">
        </div>
        <div class="field">
          <label>Água consumida hoje (litros)</label>
          <input id="dietWater" type="number" min="0" step="0.5" value="${existing?.water ?? 0}">
        </div>
      </div>
      <button class="primary" onclick="saveDietForm()">${existing ? "Salvar alterações" : "Criar dieta"}</button>
    `
  );
}

async function saveDietForm() {
  const existing = state.diet && !state.diet.deleted ? state.diet : null;
  const diet = {
    ...(existing || {}),
    id: existing?.id || "diet_main",
    name: $("#dietName").value.trim() || "Plano alimentar",
    waterTarget: Number($("#dietWaterTarget").value) || 0,
    water: Number($("#dietWater").value) || 0,
    meals: Array.isArray(existing?.meals) ? existing.meals : [],
    deleted: false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.diet = diet;
  saveLocal();

  if (isLogged()) {
    const response = await api("saveDiet", { item: diet });
    if (!response?.ok) {
      toast(response?.error || "Erro ao salvar a dieta.");
      return;
    }
  }

  closeModal();
  renderDiet();
  toast(existing ? "Dieta atualizada." : "Dieta criada.");
}

function mealModal(index = null) {
  const diet = ensureDiet();
  const meal = Number.isInteger(index) ? diet.meals[index] : null;

  openModal(
    meal ? "Editar refeição" : "Nova refeição",
    `
      <input type="hidden" id="mealIndex" value="${meal ? index : ""}">
      <div class="form-grid">
        <div class="field">
          <label>Horário</label>
          <input id="mealTime" type="time" value="${meal?.time || ""}">
        </div>
        <div class="field">
          <label>Nome</label>
          <input id="mealTitle" value="${meal?.title || ""}" placeholder="Ex.: Café da manhã">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Alimentos / descrição</label>
          <input id="mealItems" value="${meal?.items || ""}" placeholder="Ex.: 3 ovos + 1 pão francês">
        </div>
      </div>
      <button class="primary" onclick="saveMealForm()">${meal ? "Salvar alterações" : "Adicionar refeição"}</button>
    `
  );
}

async function saveMealForm() {
  const diet = ensureDiet();
  const rawIndex = $("#mealIndex").value;
  const index = rawIndex === "" ? -1 : Number(rawIndex);

  const meal = {
    ...(index >= 0 ? diet.meals[index] : {}),
    id: index >= 0 ? (diet.meals[index]?.id || uid()) : uid(),
    time: $("#mealTime").value || "",
    title: $("#mealTitle").value.trim() || "Refeição",
    items: $("#mealItems").value.trim(),
    done: index >= 0 ? !!diet.meals[index]?.done : false
  };

  if (index >= 0) diet.meals[index] = meal;
  else diet.meals.push(meal);

  diet.updatedAt = new Date().toISOString();
  saveLocal();
  if (isLogged()) await api("saveDiet", { item: diet });

  closeModal();
  renderDiet();
  toast(index >= 0 ? "Refeição atualizada." : "Refeição adicionada.");
}

async function deleteMeal(index) {
  const diet = ensureDiet();
  const meal = diet.meals[index];
  if (!meal) return;
  if (!confirm(`Excluir a refeição "${meal.title}"?`)) return;

  diet.meals.splice(index, 1);
  diet.updatedAt = new Date().toISOString();
  saveLocal();
  if (isLogged()) await api("saveDiet", { item: diet });

  renderDiet();
  toast("Refeição excluída.");
}

async function toggleMeal(index) {
  const diet = ensureDiet();
  const meal = diet.meals[index];
  if (!meal) return;

  meal.done = !meal.done;
  diet.updatedAt = new Date().toISOString();
  saveLocal();
  if (isLogged()) await api("saveDiet", { item: diet });
  renderDiet();
}

async function addWater() {
  const diet = ensureDiet();
  diet.water = Math.min(
    Number(diet.waterTarget || 0),
    +(Number(diet.water || 0) + 0.5).toFixed(1)
  );
  diet.updatedAt = new Date().toISOString();

  saveLocal();
  if (isLogged()) await api("saveDiet", { item: diet });
  renderDiet();
}

async function deleteDietItem() {
  const diet = state.diet;
  if (!diet || !confirm("Excluir toda a dieta e suas refeições?")) return;

  // O backend atual não possui deleteDiet. Salvamos um tombstone com o mesmo id.
  const tombstone = {
    ...diet,
    meals: [],
    water: 0,
    deleted: true,
    updatedAt: new Date().toISOString()
  };

  state.diet = null;
  saveLocal();

  if (isLogged()) {
    const response = await api("saveDiet", { item: tombstone });
    if (!response?.ok) console.warn("Erro ao excluir dieta no servidor:", response);
  }

  closeModal();
  renderDiet();
  toast("Dieta excluída.");
}

/* =========================
   HÁBITOS
========================= */

function renderHabits() {
  const habits = Array.isArray(state.habits) ? state.habits : [];
  const values = Array.from({ length: 98 }, (_, index) => (index * 7 + index % 5) % 5);

  $("#content").innerHTML = `
    <div class="section-head">
      <div>
        <h2>Hábitos</h2>
        <div class="muted">Cadastre, edite e acompanhe seus hábitos recorrentes.</div>
      </div>
      <button class="primary" onclick="habitModal()">+ Novo hábito</button>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Hábitos recorrentes</h3>

        ${habits.length ? habits.map(habit => `
          <div class="profile-row">
            <div class="avatar">🔥</div>
            <div style="flex:1">
              <b>${habit.title || "Hábito"}</b>
              <div class="muted">${habit.target || "Sem meta definida"}</div>
            </div>
            <span class="badge">${habit.streak || 0} dias</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="chip-btn" onclick="habitModal('${habit.id}')">Editar</button>
              <button class="chip-btn danger" onclick="deleteHabitItem('${habit.id}')">Excluir</button>
            </div>
          </div>
        `).join("") : `<div class="muted" style="margin-top:12px">Nenhum hábito cadastrado.</div>`}
      </div>

      <div class="card">
        <h3>Consistência</h3>
        <p class="muted">Últimas 14 semanas</p>
        <div class="heatmap">
          ${values.map(value => `<span class="heat l${value}"></span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function habitModal(id = null) {
  const habit = (state.habits || []).find(item => item.id === id) || null;

  openModal(
    habit ? "Editar hábito" : "Novo hábito",
    `
      <input type="hidden" id="habitEditId" value="${habit?.id || ""}">
      <div class="form-grid">
        <div class="field">
          <label>Nome do hábito</label>
          <input id="habitTitle" value="${habit?.title || ""}" placeholder="Ex.: Beber 4 L de água">
        </div>
        <div class="field">
          <label>Meta / descrição</label>
          <input id="habitTarget" value="${habit?.target || ""}" placeholder="Ex.: 4 L por dia">
        </div>
        <div class="field">
          <label>Sequência atual (dias)</label>
          <input id="habitStreak" type="number" min="0" value="${habit?.streak ?? 0}">
        </div>
      </div>
      <button class="primary" onclick="saveHabitForm()">${habit ? "Salvar alterações" : "Criar hábito"}</button>
    `
  );
}

async function saveHabitForm() {
  const id = $("#habitEditId").value || uid();
  const existing = (state.habits || []).find(item => item.id === id);
  const title = $("#habitTitle").value.trim();

  if (!title) {
    toast("Informe o nome do hábito.");
    return;
  }

  const habit = {
    ...(existing || {}),
    id,
    title,
    target: $("#habitTarget").value.trim(),
    streak: Number($("#habitStreak").value) || 0,
    deleted: false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.habits = Array.isArray(state.habits) ? state.habits : [];
  const index = state.habits.findIndex(item => item.id === id);
  if (index >= 0) state.habits[index] = habit;
  else state.habits.push(habit);

  saveLocal();
  if (isLogged()) {
    const response = await api("saveHabit", { item: habit });
    if (!response?.ok) {
      toast(response?.error || "Erro ao salvar hábito.");
      return;
    }
  }

  closeModal();
  renderHabits();
  toast(existing ? "Hábito atualizado." : "Hábito criado.");
}

async function deleteHabitItem(id) {
  const habit = (state.habits || []).find(item => item.id === id);
  if (!habit || !confirm(`Excluir o hábito "${habit.title}"?`)) return;

  state.habits = (state.habits || []).filter(item => item.id !== id);
  saveLocal();

  if (isLogged()) {
    const response = await api("deleteHabit", { id });
    if (!response?.ok) console.warn("Erro ao excluir hábito no servidor:", response);
  }

  closeModal();
  renderHabits();
  toast("Hábito excluído.");
}

/* =========================
   INSIGHTS
========================= */

function renderInsights() {
  const items = dayItems();

  const dayScore =
    items.length
      ? Math.round(
          items.reduce(
            (sum, item) =>
              sum +
              pct(
                item.value,
                item.target
              ),
            0
          ) /
          items.length
        )
      : 0;

  const dietScore =
    state.diet?.meals?.length
      ? pct(
          state.diet.meals.filter(
            meal => meal.done
          ).length,
          state.diet.meals.length
        )
      : 0;

  $("#content").innerHTML = `
    <div class="grid cols-3">

      <div class="card">
        <div class="metric-label">
          Pontuação do dia
        </div>

        <div class="big">
          ${dayScore}%
        </div>
      </div>

      <div class="card">
        <div class="metric-label">
          Dieta
        </div>

        <div class="big">
          ${dietScore}%
        </div>
      </div>

      <div class="card">
        <div class="metric-label">
          Sequência
        </div>

        <div class="big">
          ${state.user?.streak || 0}
          dias
        </div>
      </div>

    </div>

    <div class="section-head">
      <h2>Resumo semanal</h2>
    </div>

    <div class="card">
      <canvas id="weekChart"></canvas>
    </div>

    <div class="section-head">
      <h2>Conquistas</h2>
    </div>

    <div class="grid cols-4">

      ${
        (state.achievements || [])
          .map(
            achievement => `

              <div class="card">

                <div class="big">
                  ${achievement.icon}
                </div>

                <b>
                  ${achievement.title}
                </b>

                <div class="muted">
                  ${
                    achievement.done
                      ? "Conquistada"
                      : "Em andamento"
                  }
                </div>

              </div>

            `
          )
          .join("")
      }

    </div>
  `;

  setTimeout(() => {
    const canvas = $("#weekChart");

    if (!canvas) return;

    const chart =
      new Chart(
        canvas,
        {
          type: "bar",

          data: {
            labels: [
              "Seg",
              "Ter",
              "Qua",
              "Qui",
              "Sex",
              "Sáb",
              "Dom"
            ],

            datasets: [
              {
                label: "Conclusão %",
                data: [
                  76,
                  91,
                  68,
                  88,
                  dayScore,
                  0,
                  0
                ]
              }
            ]
          },

          options: {
            scales: {
              y: {
                beginAtZero: true,
                max: 100
              }
            },

            plugins: {
              legend: {
                display: false
              }
            }
          }
        }
      );

    charts.push(chart);

  }, 0);
}

/* =========================
   DESAFIOS ENTRE AMIGOS
========================= */

function challengeUserId() {
  return String(
    state.user?.id ||
    state.user?.user_id ||
    state.user?.userId ||
    "LOCAL_USER"
  );
}

function challengeUserName() {
  return state.user?.name || state.user?.nome || "Você";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function challengeTypeMeta(type) {
  const map = {
    weight_loss: { label: "Perda de peso", unit: "kg", icon: "⚖", higherWins: true },
    workouts: { label: "Treinos concluídos", unit: "treinos", icon: "🏋", higherWins: true },
    cardio: { label: "Cardio", unit: "min", icon: "🏃", higherWins: true },
    habits: { label: "Hábitos concluídos", unit: "dias", icon: "🔥", higherWins: true },
    water: { label: "Água", unit: "L", icon: "💧", higherWins: true },
    xp: { label: "XP", unit: "XP", icon: "⚡", higherWins: true }
  };
  return map[type] || map.workouts;
}

function challengeStatusLabel(status) {
  const map = {
    pending: "Aguardando aceite",
    active: "Em andamento",
    completed: "Finalizado",
    cancelled: "Cancelado",
    rejected: "Recusado"
  };
  return map[status] || status || "Em andamento";
}

function challengeProgress(participant, challenge) {
  const target = Number(challenge.target || 0);
  const value = Number(participant.progress || 0);
  return target > 0 ? Math.max(0, Math.min(100, Math.round((value / target) * 100))) : 0;
}

function sortChallengeParticipants(challenge) {
  return [...(challenge.participants || [])].sort((a, b) => {
    const pa = challengeProgress(a, challenge);
    const pb = challengeProgress(b, challenge);
    if (pb !== pa) return pb - pa;
    return Number(b.progress || 0) - Number(a.progress || 0);
  });
}

function ensureChallengesArray() {
  if (!Array.isArray(state.challenges)) state.challenges = [];
  return state.challenges;
}

async function loadChallenges() {
  ensureChallengesArray();
  if (!isLogged()) return state.challenges;

  const response = await api("listChallenges");
  if (response?.ok) {
    const items = Array.isArray(response.items)
      ? response.items
      : Array.isArray(response.challenges)
        ? response.challenges
        : [];
    state.challenges = items;
    saveLocal();
  }
  return state.challenges;
}

async function renderChallenges() {
  $("#content").innerHTML = `<div class="card">Carregando desafios...</div>`;
  await loadChallenges();

  const me = challengeUserId();
  const challenges = ensureChallengesArray().filter(item => !item.deleted);
  const pending = challenges.filter(challenge =>
    (challenge.participants || []).some(p =>
      String(p.user_id) === me && p.status === "pending"
    )
  );
  const active = challenges.filter(challenge =>
    ["active", "pending"].includes(challenge.status) &&
    !pending.includes(challenge)
  );
  const finished = challenges.filter(challenge =>
    ["completed", "cancelled", "rejected"].includes(challenge.status)
  );

  $("#content").innerHTML = `
    <div class="section-head">
      <div>
        <h2>Desafios entre amigos</h2>
        <div class="muted">Compita com seus amigos e acompanhe o ranking em tempo real.</div>
      </div>
      <button class="primary" onclick="challengeModal()">+ Novo desafio</button>
    </div>

    ${pending.length ? `
      <div class="section-head"><h2 style="font-size:18px">Convites recebidos</h2></div>
      <div class="grid cols-2">
        ${pending.map(challenge => challengeCard(challenge, true)).join("")}
      </div>
    ` : ""}

    <div class="grid cols-3" style="margin-bottom:16px">
      <div class="card"><div class="metric-label">Em andamento</div><div class="big">${active.filter(c => c.status === "active").length}</div></div>
      <div class="card"><div class="metric-label">Aguardando</div><div class="big">${challenges.filter(c => c.status === "pending").length}</div></div>
      <div class="card"><div class="metric-label">Finalizados</div><div class="big">${finished.filter(c => c.status === "completed").length}</div></div>
    </div>

    <div class="section-head"><h2 style="font-size:18px">Meus desafios</h2></div>
    ${active.length ? `
      <div class="grid cols-2">${active.map(challenge => challengeCard(challenge, false)).join("")}</div>
    ` : `<div class="card muted">Você ainda não tem desafios ativos. Crie um e convide um amigo.</div>`}

    ${finished.length ? `
      <div class="section-head"><h2 style="font-size:18px">Histórico</h2></div>
      <div class="grid cols-2">${finished.map(challenge => challengeCard(challenge, false)).join("")}</div>
    ` : ""}
  `;
}

function challengeCard(challenge, inviteMode = false) {
  const meta = challengeTypeMeta(challenge.type);
  const ranking = sortChallengeParticipants(challenge);
  const me = challengeUserId();
  const myParticipant = (challenge.participants || []).find(p => String(p.user_id) === me);
  const myProgress = myParticipant ? challengeProgress(myParticipant, challenge) : 0;
  const creator = String(challenge.created_by) === me;
  const canUpdate = challenge.status === "active" && myParticipant?.status === "accepted";

  return `
    <div class="card goal-card">
      <div class="goal-top">
        <div>
          <div class="goal-title">${meta.icon} ${escapeHtml(challenge.title || meta.label)}</div>
          <div class="goal-meta">${meta.label} · ${escapeHtml(challenge.start_date || "")} → ${escapeHtml(challenge.end_date || "")}</div>
        </div>
        <span class="badge">${challengeStatusLabel(challenge.status)}</span>
      </div>

      <div style="margin:14px 0">
        <div class="metric-row">
          <span class="muted">Sua evolução</span>
          <b>${Number(myParticipant?.progress || 0)} / ${Number(challenge.target || 0)} ${escapeHtml(challenge.unit || meta.unit)}</b>
        </div>
        <div class="progress"><span style="width:${myProgress}%"></span></div>
      </div>

      <div style="margin-top:12px">
        ${ranking.slice(0, 3).map((p, index) => `
          <div class="profile-row" style="padding:8px 0">
            <div style="width:28px;font-weight:800">${["🥇","🥈","🥉"][index] || index + 1}</div>
            <div class="avatar">${escapeHtml((p.name || "U").slice(0,1))}</div>
            <div style="flex:1"><b>${escapeHtml(p.name || "Participante")}</b><div class="muted">${Number(p.progress || 0)} ${escapeHtml(challenge.unit || meta.unit)}</div></div>
            <span class="pill">${challengeProgress(p, challenge)}%</span>
          </div>
        `).join("")}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
        ${inviteMode ? `
          <button class="primary" onclick="acceptChallenge('${challenge.id}')">Aceitar desafio</button>
          <button class="chip-btn danger" onclick="rejectChallenge('${challenge.id}')">Recusar</button>
        ` : `
          <button class="chip-btn" onclick="viewChallenge('${challenge.id}')">Ver ranking</button>
          ${canUpdate ? `<button class="chip-btn good" onclick="challengeProgressModal('${challenge.id}')">Atualizar progresso</button>` : ""}
          ${creator && challenge.status !== "completed" ? `<button class="chip-btn" onclick="editChallengeModal('${challenge.id}')">Editar</button>` : ""}
          ${creator ? `<button class="chip-btn danger" onclick="deleteChallenge('${challenge.id}')">Excluir</button>` : challenge.status === "active" ? `<button class="chip-btn danger" onclick="leaveChallenge('${challenge.id}')">Abandonar</button>` : ""}
        `}
      </div>
    </div>
  `;
}

async function challengeModal(editId = null) {
  const challenge = editId ? ensureChallengesArray().find(c => c.id === editId) : null;
  let friends = [];

  if (isLogged()) {
    const response = await api("listFriends");
    if (response?.ok) friends = response.friends || response.items || [];
  }

  if (!friends.length) {
    friends = (state.friends || []).filter(friend => friend.status === "friend");
  }

  const selectedIds = new Set((challenge?.participants || []).map(p => String(p.user_id)));
  const type = challenge?.type || "workouts";
  const meta = challengeTypeMeta(type);

  openModal(editId ? "Editar desafio" : "Novo desafio", `
    <div class="form-grid">
      <div class="field" style="grid-column:1/-1"><label>Nome do desafio</label><input id="challengeTitle" value="${escapeHtml(challenge?.title || "")}" placeholder="Ex.: 30 dias sem faltar treino"></div>
      <div class="field"><label>Tipo</label><select id="challengeType" onchange="updateChallengeUnit()">
        ${[
          ["weight_loss","Perda de peso"], ["workouts","Treinos concluídos"], ["cardio","Cardio"],
          ["habits","Hábitos concluídos"], ["water","Água"], ["xp","XP"]
        ].map(([value,label]) => `<option value="${value}" ${type===value?"selected":""}>${label}</option>`).join("")}
      </select></div>
      <div class="field"><label>Meta individual</label><input id="challengeTarget" type="number" step="0.1" min="0" value="${challenge?.target ?? ""}"></div>
      <div class="field"><label>Unidade</label><input id="challengeUnit" value="${escapeHtml(challenge?.unit || meta.unit)}"></div>
      <div class="field"><label>Início</label><input id="challengeStart" type="date" value="${challenge?.start_date || iso()}"></div>
      <div class="field"><label>Fim</label><input id="challengeEnd" type="date" value="${challenge?.end_date || ""}"></div>
    </div>

    <div class="section-head" style="margin-top:16px"><h2 style="font-size:16px">Convidar amigos</h2></div>
    <div class="card" style="padding:8px 14px;max-height:220px;overflow:auto">
      ${friends.length ? friends.map(friend => {
        const id = String(friend.id || friend.user_id);
        const checked = selectedIds.has(id) && id !== challengeUserId();
        return `<label class="profile-row" style="cursor:pointer">
          <input type="checkbox" class="challengeFriend" value="${escapeHtml(id)}" ${checked ? "checked" : ""}>
          <div class="avatar">${escapeHtml((friend.name || friend.nome || "U").slice(0,1))}</div>
          <div style="flex:1"><b>${escapeHtml(friend.name || friend.nome || "Amigo")}</b></div>
        </label>`;
      }).join("") : `<div class="muted" style="padding:12px 0">Adicione amigos em Pessoas para criar desafios com eles.</div>`}
    </div>

    <button class="primary" style="margin-top:16px" onclick="saveChallenge('${editId || ""}')">${editId ? "Salvar alterações" : "Criar e convidar"}</button>
  `);
}

function updateChallengeUnit() {
  const field = $("#challengeType");
  const unit = $("#challengeUnit");
  if (field && unit) unit.value = challengeTypeMeta(field.value).unit;
}

function editChallengeModal(id) {
  challengeModal(id);
}

async function saveChallenge(editId = "") {
  const title = $("#challengeTitle")?.value.trim();
  const type = $("#challengeType")?.value || "workouts";
  const target = Number($("#challengeTarget")?.value || 0);
  const unit = $("#challengeUnit")?.value.trim() || challengeTypeMeta(type).unit;
  const start_date = $("#challengeStart")?.value || iso();
  const end_date = $("#challengeEnd")?.value || "";
  const friendIds = [...document.querySelectorAll(".challengeFriend:checked")].map(el => el.value);

  if (!title) return toast("Informe o nome do desafio.");
  if (!target || target <= 0) return toast("Informe uma meta maior que zero.");
  if (!end_date) return toast("Informe a data final.");
  if (end_date < start_date) return toast("A data final deve ser após a data inicial.");
  if (!editId && !friendIds.length) return toast("Selecione pelo menos um amigo.");

  const me = challengeUserId();
  const existing = editId ? ensureChallengesArray().find(c => c.id === editId) : null;
  const friendSource = [ ...(state.friends || []) ];
  const previousById = new Map((existing?.participants || []).map(p => [String(p.user_id), p]));

  const participants = [me, ...friendIds].filter((id, index, arr) => arr.indexOf(id) === index).map(id => {
    const old = previousById.get(String(id));
    const friend = friendSource.find(f => String(f.id || f.user_id) === String(id));
    return old || {
      user_id: String(id),
      name: String(id) === me ? challengeUserName() : (friend?.name || friend?.nome || "Amigo"),
      status: String(id) === me ? "accepted" : "pending",
      progress: 0,
      joined_at: String(id) === me ? new Date().toISOString() : ""
    };
  });

  const item = {
    id: existing?.id || `CH_${uid()}`,
    title,
    type,
    target,
    unit,
    start_date,
    end_date,
    status: existing?.status || "pending",
    created_by: existing?.created_by || me,
    created_by_name: existing?.created_by_name || challengeUserName(),
    participants,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isLogged()) {
    const action = editId ? "updateChallenge" : "createChallenge";
    const response = await api(action, { item });
    if (!response?.ok) {
      toast(response?.error || "Não foi possível salvar o desafio.");
      return;
    }
    if (response.item) Object.assign(item, response.item);
  }

  if (existing) Object.assign(existing, item);
  else ensureChallengesArray().push(item);
  saveLocal();
  closeModal();
  toast(editId ? "Desafio atualizado." : "Desafio criado. Convites enviados.");
  renderChallenges();
}

async function acceptChallenge(id) {
  const response = isLogged() ? await api("acceptChallenge", { challenge_id: id }) : { ok: true };
  if (!response?.ok) return toast(response?.error || "Não foi possível aceitar.");
  const challenge = ensureChallengesArray().find(c => c.id === id);
  const p = challenge?.participants?.find(p => String(p.user_id) === challengeUserId());
  if (p) { p.status = "accepted"; p.joined_at = new Date().toISOString(); }
  if (challenge) challenge.status = "active";
  saveLocal();
  toast("Desafio aceito!");
  renderChallenges();
}

async function rejectChallenge(id) {
  const response = isLogged() ? await api("rejectChallenge", { challenge_id: id }) : { ok: true };
  if (!response?.ok) return toast(response?.error || "Não foi possível recusar.");
  const challenge = ensureChallengesArray().find(c => c.id === id);
  const p = challenge?.participants?.find(p => String(p.user_id) === challengeUserId());
  if (p) p.status = "rejected";
  saveLocal();
  toast("Convite recusado.");
  renderChallenges();
}

function challengeProgressModal(id) {
  const challenge = ensureChallengesArray().find(c => c.id === id);
  if (!challenge) return;
  const participant = (challenge.participants || []).find(p => String(p.user_id) === challengeUserId());
  const suggested = getAutomaticChallengeProgress(challenge);
  openModal("Atualizar progresso", `
    <div class="card" style="margin-bottom:14px">
      <b>${escapeHtml(challenge.title)}</b>
      <div class="muted">Meta: ${challenge.target} ${escapeHtml(challenge.unit || challengeTypeMeta(challenge.type).unit)}</div>
    </div>
    <div class="field"><label>Seu progresso atual</label><input id="challengeProgressValue" type="number" step="0.1" min="0" value="${suggested ?? participant?.progress ?? 0}"></div>
    ${suggested != null ? `<div class="muted" style="margin:8px 0 14px">Valor sugerido automaticamente com base nos seus dados do MetaLife.</div>` : ""}
    <button class="primary" onclick="updateChallengeProgress('${id}')">Salvar progresso</button>
  `);
}

function getAutomaticChallengeProgress(challenge) {
  const start = new Date(`${challenge.start_date}T00:00:00`);
  const end = new Date(`${challenge.end_date}T23:59:59`);
  const inRange = value => {
    const d = new Date(`${normalizeDate(value)}T12:00:00`);
    return d >= start && d <= end;
  };

  if (challenge.type === "xp") return Number(state.user?.xp || 0);
  if (challenge.type === "workouts") return (state.workouts || []).filter(w => w.finished && inRange(w.date || w.last || iso())).length;
  if (challenge.type === "cardio") return ensureDailyArray().filter(i => i.category === "Cardio" && inRange(i.date)).reduce((sum, i) => sum + Number(i.value || 0), 0);
  if (challenge.type === "habits") return (state.habits || []).reduce((sum, h) => sum + Number(h.completedCount || h.streak || 0), 0);
  if (challenge.type === "water") return Number(state.diet?.water || 0);
  if (challenge.type === "weight_loss") {
    const weights = (state.weight || []).filter(w => inRange(w.date)).sort((a,b) => new Date(a.date)-new Date(b.date));
    if (weights.length >= 2) return Math.max(0, Number(weights[0].value) - Number(weights.at(-1).value));
    return null;
  }
  return null;
}

async function updateChallengeProgress(id) {
  const value = Number($("#challengeProgressValue")?.value || 0);
  if (value < 0) return toast("Informe um valor válido.");
  const response = isLogged() ? await api("updateChallengeProgress", { challenge_id: id, progress: value }) : { ok: true };
  if (!response?.ok) return toast(response?.error || "Não foi possível atualizar.");
  const challenge = ensureChallengesArray().find(c => c.id === id);
  const participant = challenge?.participants?.find(p => String(p.user_id) === challengeUserId());
  if (participant) { participant.progress = value; participant.updated_at = new Date().toISOString(); }
  saveLocal();
  closeModal();
  toast("Progresso atualizado.");
  renderChallenges();
}

function viewChallenge(id) {
  const challenge = ensureChallengesArray().find(c => c.id === id);
  if (!challenge) return;
  const ranking = sortChallengeParticipants(challenge);
  const meta = challengeTypeMeta(challenge.type);
  openModal("Ranking — " + challenge.title, `
    <div class="grid cols-3" style="margin-bottom:14px">
      <div class="card"><div class="metric-label">Tipo</div><div class="big" style="font-size:18px">${meta.icon} ${meta.label}</div></div>
      <div class="card"><div class="metric-label">Meta</div><div class="big" style="font-size:18px">${challenge.target} ${escapeHtml(challenge.unit || meta.unit)}</div></div>
      <div class="card"><div class="metric-label">Status</div><div class="big" style="font-size:18px">${challengeStatusLabel(challenge.status)}</div></div>
    </div>
    <div class="card">
      ${ranking.map((p, index) => `
        <div class="profile-row">
          <div style="width:34px;font-size:20px">${index < 3 ? ["🥇","🥈","🥉"][index] : `#${index+1}`}</div>
          <div class="avatar">${escapeHtml((p.name || "U").slice(0,1))}</div>
          <div style="flex:1"><b>${escapeHtml(p.name || "Participante")}</b><div class="muted">${p.status === "pending" ? "Convite pendente" : `${Number(p.progress || 0)} ${escapeHtml(challenge.unit || meta.unit)}`}</div></div>
          <span class="pill">${challengeProgress(p, challenge)}%</span>
        </div>
      `).join("")}
    </div>
  `);
}

async function leaveChallenge(id) {
  if (!confirm("Deseja abandonar este desafio?")) return;
  const response = isLogged() ? await api("leaveChallenge", { challenge_id: id }) : { ok: true };
  if (!response?.ok) return toast(response?.error || "Não foi possível abandonar.");
  const challenge = ensureChallengesArray().find(c => c.id === id);
  const p = challenge?.participants?.find(p => String(p.user_id) === challengeUserId());
  if (p) p.status = "left";
  saveLocal();
  toast("Você saiu do desafio.");
  renderChallenges();
}

async function deleteChallenge(id) {
  if (!confirm("Excluir este desafio para todos os participantes?")) return;
  const response = isLogged() ? await api("deleteChallenge", { challenge_id: id }) : { ok: true };
  if (!response?.ok) return toast(response?.error || "Não foi possível excluir.");
  state.challenges = ensureChallengesArray().filter(c => c.id !== id);
  saveLocal();
  toast("Desafio excluído.");
  renderChallenges();
}

/* =========================
   PESSOAS
========================= */

async function renderPeople() {
  $("#content").innerHTML = `
    <div class="card">
      Carregando pessoas e solicitações...
    </div>
  `;

  if (!isLogged()) {
    renderPeopleLocal();
    return;
  }

  try {
    const [usersResponse, invitesResponse, friendsResponse] = await Promise.all([
      api("listUsers"),
      api("listInvites"),
      api("listFriends")
    ]);

    const users = usersResponse?.ok ? (usersResponse.users || []) : [];
    const received = invitesResponse?.ok ? (invitesResponse.received || []) : [];
    const sent = invitesResponse?.ok ? (invitesResponse.sent || []) : [];
    const friends = friendsResponse?.ok ? (friendsResponse.friends || []) : [];

    // Mantém a lista local sincronizada para Chats e Desafios.
    if (friendsResponse?.ok) {
      state.friends = friends.map(friend => ({
        ...friend,
        status: "friend"
      }));
      saveLocal();
    }

    const friendIds = new Set(friends.map(friend => String(friend.id || friend.user_id)));
    const sentIds = new Set(sent.map(invite => String(invite.user_id)));
    const receivedIds = new Set(received.map(invite => String(invite.user_id)));

    const fmtInviteDate = value => {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    };

    $("#content").innerHTML = `
      <div class="section-head">
        <div>
          <h2>Pessoas</h2>
          <div class="muted">Gerencie amizades, solicitações e pessoas do MetaLife.</div>
        </div>
        ${received.length ? `<span class="pill">${received.length} pendente${received.length > 1 ? "s" : ""}</span>` : ""}
      </div>

      ${received.length ? `
        <div class="section-head" style="margin-top:8px">
          <div>
            <h2 style="font-size:18px">Solicitações recebidas</h2>
            <div class="muted">Pessoas que querem adicionar você.</div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          ${received.map(invite => `
            <div class="profile-row">
              <div class="avatar">${escapeHtml((invite.name || "U").slice(0, 1))}</div>
              <div style="flex:1">
                <b>${escapeHtml(invite.name || "Usuário")}</b>
                <div class="muted">
                  Quer adicionar você${fmtInviteDate(invite.created_at) ? ` · ${fmtInviteDate(invite.created_at)}` : ""}
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="chip-btn good" onclick="acceptFriendInvite('${invite.id}')">✓ Aceitar</button>
                <button class="chip-btn danger" onclick="rejectFriendInvite('${invite.id}')">✕ Recusar</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : ""}

      <div class="section-head">
        <div>
          <h2 style="font-size:18px">Meus amigos</h2>
          <div class="muted">Amigos disponíveis para conversar e participar de desafios.</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        ${friends.length ? friends.map(friend => `
          <div class="profile-row">
            <div class="avatar">${escapeHtml((friend.name || "U").slice(0, 1))}</div>
            <div style="flex:1">
              <b>${escapeHtml(friend.name || "Amigo")}</b>
              <div class="muted">Nível ${Number(friend.level || 1)} · ${Number(friend.xp || 0)} XP · 🔥 ${Number(friend.streak || 0)} dias</div>
            </div>
            <button class="chip-btn" onclick="openChat('${friend.id}')">Conversar</button>
          </div>
        `).join("") : `<div class="muted">Você ainda não adicionou nenhum amigo.</div>`}
      </div>

      ${sent.length ? `
        <div class="section-head">
          <div>
            <h2 style="font-size:18px">Solicitações enviadas</h2>
            <div class="muted">Convites aguardando resposta.</div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          ${sent.map(invite => `
            <div class="profile-row">
              <div class="avatar">${escapeHtml((invite.name || "U").slice(0, 1))}</div>
              <div style="flex:1">
                <b>${escapeHtml(invite.name || "Usuário")}</b>
                <div class="muted">Aguardando resposta${fmtInviteDate(invite.created_at) ? ` · ${fmtInviteDate(invite.created_at)}` : ""}</div>
              </div>
              <button class="chip-btn danger" onclick="cancelFriendInvite('${invite.id}')">Cancelar</button>
            </div>
          `).join("")}
        </div>
      ` : ""}

      <div class="section-head">
        <div>
          <h2 style="font-size:18px">Encontrar pessoas</h2>
          <div class="muted">Usuários cadastrados no MetaLife.</div>
        </div>
      </div>

      <div class="card">
        ${users.length ? users.map(user => {
          const id = String(user.id);
          let action = "";

          if (friendIds.has(id)) {
            action = `<span class="pill">Amigo</span>`;
          } else if (sentIds.has(id)) {
            action = `<span class="pill">Enviado</span>`;
          } else if (receivedIds.has(id)) {
            action = `<span class="pill">Responda acima</span>`;
          } else {
            action = `<button class="chip-btn good" onclick="inviteServer('${user.id}')">Convidar</button>`;
          }

          return `
            <div class="profile-row">
              <div class="avatar">${escapeHtml((user.name || "U").slice(0, 1))}</div>
              <div style="flex:1">
                <b>${escapeHtml(user.name || "Usuário")}</b>
                <div class="muted">Nível ${Number(user.level || 1)} · ${Number(user.xp || 0)} XP</div>
              </div>
              ${action}
            </div>
          `;
        }).join("") : `<div class="muted">Nenhum outro usuário cadastrado.</div>`}
      </div>
    `;
  } catch (error) {
    console.error(error);
    toast("Não foi possível carregar as solicitações.");
    renderPeopleLocal();
  }
}

function renderPeopleLocal() {
  $("#content").innerHTML = `
    <div class="section-head">
      <h2>Pessoas</h2>
    </div>

    <div class="card">
      ${(state.friends || []).length
        ? (state.friends || []).map(friend => `
            <div class="profile-row">
              <div class="avatar">${escapeHtml((friend.name || "U").slice(0, 1))}</div>
              <div style="flex:1">
                <b>${escapeHtml(friend.name || "Amigo")}</b>
                <div class="muted">🔥 ${Number(friend.streak || 0)} dias de sequência</div>
              </div>
              ${friend.status === "friend"
                ? `<button class="chip-btn" onclick="openChat('${friend.id}')">Conversar</button>`
                : `<button class="chip-btn good" onclick="invite('${friend.id}')">Convidar</button>`}
            </div>
          `).join("")
        : `<div class="muted">Entre na sua conta para gerenciar solicitações de amizade.</div>`}
    </div>
  `;
}

async function inviteServer(userId) {
  const response = await api("inviteUser", {
    para_user: userId
  });

  if (response?.ok) {
    toast("Convite enviado.");
    await renderPeople();
  } else {
    toast(response?.error || "Não foi possível enviar.");
  }
}

async function acceptFriendInvite(inviteId) {
  const response = await api("acceptInvite", {
    invite_id: inviteId
  });

  if (!response?.ok) {
    toast(response?.error || "Não foi possível aceitar o convite.");
    return;
  }

  toast("Solicitação aceita. Agora vocês são amigos.");
  await renderPeople();
}

async function rejectFriendInvite(inviteId) {
  const response = await api("rejectInvite", {
    invite_id: inviteId
  });

  if (!response?.ok) {
    toast(response?.error || "Não foi possível recusar o convite.");
    return;
  }

  toast("Solicitação recusada.");
  await renderPeople();
}

async function cancelFriendInvite(inviteId) {
  if (!confirm("Cancelar esta solicitação de amizade?")) return;

  const response = await api("cancelInvite", {
    invite_id: inviteId
  });

  if (!response?.ok) {
    toast(response?.error || "Não foi possível cancelar o convite.");
    return;
  }

  toast("Solicitação cancelada.");
  await renderPeople();
}

function invite(id) {
  const friend = (state.friends || []).find(item => item.id === id);
  if (!friend) return;

  friend.status = "invited";
  saveLocal();
  toast("Convite enviado.");
}

/* =========================
   CHAT — SINCRONIZADO COM O SERVIDOR
========================= */

const mlChatState = {
  conversations: [],
  activeId: null,
  messages: [],
  pollTimer: null,
  loadingMessages: false,
  notificationTimer: null,
  notificationReady: false,
  unreadSnapshot: {},
  audioContext: null,
  lastNotificationAt: {}
};

function mlStopChatPolling() {
  if (mlChatState.pollTimer) {
    clearInterval(mlChatState.pollTimer);
    mlChatState.pollTimer = null;
  }
}

function mlChatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function mlChatDay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return "Hoje";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function mlMyUserId() {
  return String(
    state.user?.id ||
    state.user?.user_id ||
    state.profile?.id ||
    state.profile?.user_id ||
    localStorage.getItem("ml_user_id") ||
    ""
  );
}

/* =========================================================
   NOTIFICAÇÕES DO CHAT
========================================================= */

function mlEnableNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!mlChatState.audioContext) {
      mlChatState.audioContext = new AudioContextClass();
    }

    if (mlChatState.audioContext.state === "suspended") {
      mlChatState.audioContext.resume().catch(() => {});
    }
  } catch (error) {
    console.warn("Áudio de notificação indisponível.", error);
  }
}

function mlPlayNotificationSound() {
  try {
    mlEnableNotificationSound();
    const ctx = mlChatState.audioContext;
    if (!ctx || ctx.state !== "running") return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);

    [880, 1174].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.connect(gain);
      const start = ctx.currentTime + index * 0.11;
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    });
  } catch (error) {
    console.warn("Não foi possível tocar a notificação.", error);
  }
}

async function mlRequestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.warn("Permissão de notificação não concedida.", error);
    return false;
  }
}

function mlDesktopNotification(conversation, text) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  try {
    const notification = new Notification(conversation?.name || "MetaLife", {
      body: text || "Você recebeu uma nova mensagem.",
      tag: `metalife-chat-${conversation?.id || "message"}`,
      renotify: true
    });

    notification.onclick = () => {
      window.focus();
      show("Chats");
      setTimeout(() => selectChatConversation(String(conversation.id)), 150);
      notification.close();
    };
  } catch (error) {
    console.warn("Notificação do navegador indisponível.", error);
  }
}

function mlChatNotificationToast(conversation, text, unreadCount = 1) {
  let host = document.getElementById("mlMessageNotifications");
  if (!host) {
    host = document.createElement("div");
    host.id = "mlMessageNotifications";
    host.className = "ml-message-notifications";
    document.body.appendChild(host);
  }

  const item = document.createElement("button");
  item.type = "button";
  item.className = "ml-message-notification";
  item.setAttribute("aria-live", "polite");
  item.innerHTML = `
    <div class="ml-message-notification-avatar">${mlChatAvatar(conversation?.name)}</div>
    <div class="ml-message-notification-copy">
      <div class="ml-message-notification-label">Nova mensagem${unreadCount > 1 ? ` · ${unreadCount} não lidas` : ""}</div>
      <strong>${escapeHtml(conversation?.name || "Amigo")}</strong>
      <span>${escapeHtml(text || "Enviou uma mensagem.")}</span>
    </div>
    <div class="ml-message-notification-dot"></div>
  `;

  item.onclick = () => {
    show("Chats");
    setTimeout(() => selectChatConversation(String(conversation.id)), 120);
    item.remove();
  };

  host.appendChild(item);
  requestAnimationFrame(() => item.classList.add("show"));

  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 250);
  }, 6500);
}

function mlNotifyNewMessage(conversation, text, unreadCount = 1) {
  if (!conversation) return;

  const conversationId = String(conversation.id || "");
  const nowMs = Date.now();
  const lastAt = Number(mlChatState.lastNotificationAt[conversationId] || 0);
  if (nowMs - lastAt < 800) return;
  mlChatState.lastNotificationAt[conversationId] = nowMs;

  mlPlayNotificationSound();
  mlChatNotificationToast(conversation, text, unreadCount);

  // Aviso interno: não depende de permissão de notificação do navegador.
}

let mlNotificationRequest = null;
async function mlCheckChatNotifications(firstCheck = false) {
  if (!isLogged() || mlNotificationRequest) return;
  const request = {};
  mlNotificationRequest = request;

  try {
    const response = await api("listConversations");
    if (!response?.ok) return;

    const conversations = Array.isArray(response.conversations) ? response.conversations : [];
    if (conversations.some(item => item.unread_count === undefined)) {
      if (!mlChatState.warnedUnreadSupport) {
        toast("Atualize a implantação do Apps Script para habilitar os avisos de mensagens não lidas.");
        mlChatState.warnedUnreadSupport = true;
      }
      return;
    }
    mlChatState.conversations = conversations;
    if (currentPage === "Chats") renderChatConversationList();
    let totalUnread = 0;

    for (const conversation of conversations) {
      const id = String(conversation.id);
      const unread = Number(conversation.unread_count || 0);
      const previous = Number(mlChatState.unreadSnapshot[id] || 0);
      totalUnread += unread;

      const activeVisible =
        currentPage === "Chats" &&
        String(mlChatState.activeId || "") === id &&
        !document.hidden;

      if (!activeVisible) {
        if ((firstCheck || !mlChatState.notificationReady) && unread > 0) {
          mlNotifyNewMessage(
            conversation,
            conversation.last_message || "Você tem uma mensagem não lida.",
            unread
          );
        } else if (mlChatState.notificationReady && unread > previous) {
          mlNotifyNewMessage(
            conversation,
            conversation.last_message || "Enviou uma nova mensagem.",
            unread
          );
        }
      }

      mlChatState.unreadSnapshot[id] = unread;
    }

    Object.keys(mlChatState.unreadSnapshot).forEach(id => {
      if (!conversations.some(c => String(c.id) === id)) {
        delete mlChatState.unreadSnapshot[id];
      }
    });

    mlChatState.notificationReady = true;
    mlUpdateChatUnreadBadge(totalUnread);
  } catch (error) {
    console.warn("Erro ao verificar novas mensagens.", error);
  } finally {
    if (mlNotificationRequest === request) mlNotificationRequest = null;
  }
}

function mlUpdateChatUnreadBadge(totalUnread) {
  totalUnread = Math.max(0, Number(totalUnread) || 0);
  document.documentElement.dataset.chatUnread = String(totalUnread);
  const count = totalUnread > 99 ? "99+" : String(totalUnread);
  document.querySelectorAll('[data-nav-page="Chats"], .nav-more').forEach(button => {
    let badge = button.querySelector(".ml-chat-nav-badge");
    if (totalUnread > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "ml-chat-nav-badge";
        button.appendChild(badge);
      }
      badge.textContent = count;
      badge.setAttribute("aria-label", count + " mensagens não lidas");
    } else if (badge) badge.remove();
  });
  let banner = document.getElementById("mlUnreadBanner");
  if (!banner && totalUnread > 0) {
    banner = document.createElement("button");
    banner.id = "mlUnreadBanner";
    banner.type = "button";
    banner.className = "ml-unread-banner";
    banner.setAttribute("aria-live", "polite");
    banner.onclick = () => show("Chats");
    document.querySelector(".topbar").after(banner);
  }
  if (banner) {
    banner.hidden = totalUnread === 0;
    const text = totalUnread === 1 ? "Você tem 1 mensagem não lida no chat. Toque para abrir." : "Você tem " + count + " mensagens não lidas no chat. Toque para abrir.";
    if (banner.textContent !== text) banner.textContent = text;
  }
  document.title = totalUnread > 0 ? "(" + count + ") MetaLife" : "MetaLife";
}

function mlStartMessageNotifications() {
  mlStopMessageNotifications();
  mlChatState.notificationReady = false;
  mlChatState.unreadSnapshot = {};

  mlCheckChatNotifications(true);
  mlChatState.notificationTimer = setInterval(() => {
    if (isLogged() && !document.hidden) mlCheckChatNotifications(false);
  }, 7000);
}

function mlStopMessageNotifications() {
  mlNotificationRequest = null;
  mlUpdateChatUnreadBadge(0);
  document.getElementById("mlMessageNotifications")?.replaceChildren();
  if (mlChatState.notificationTimer) {
    clearInterval(mlChatState.notificationTimer);
    mlChatState.notificationTimer = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isLogged()) mlCheckChatNotifications(false);
});

function mlArmBrowserNotifications() {
  mlEnableNotificationSound();
  // O aviso interno não solicita permissão do sistema operacional.
}

document.addEventListener("pointerdown", mlEnableNotificationSound, { once: true });
document.addEventListener("keydown", mlEnableNotificationSound, { once: true });

function mlChatAvatar(name) {
  const parts = String(name || "U").trim().split(/\s+/).filter(Boolean);
  return escapeHtml((parts[0]?.[0] || "U") + (parts[1]?.[0] || ""));
}

function mlRenderChatShell() {
  $("#content").innerHTML = `
    <div class="chat-app">
      <aside class="chat-sidebar-panel">
        <div class="chat-sidebar-head">
          <div>
            <h2>Conversas</h2>
            <div class="muted">Mensagens com seus amigos</div>
          </div>
          <button class="chat-icon-button" title="Atualizar" onclick="loadChatConversations(true)">↻</button>
        </div>
        <div id="chatConversationList" class="chat-conversation-list">
          <div class="chat-empty-small">Carregando conversas...</div>
        </div>
      </aside>

      <section id="chatMainPanel" class="chat-main-panel">
        <div class="chat-empty-state">
          <div class="chat-empty-icon">💬</div>
          <h3>Suas conversas</h3>
          <p>Escolha um amigo para começar a conversar.</p>
        </div>
      </section>
    </div>
  `;
}

async function renderChats() {
  mlStopChatPolling();
  mlRenderChatShell();

  if (!isLogged()) {
    $("#chatConversationList").innerHTML = `<div class="chat-empty-small">Entre na sua conta para usar o chat.</div>`;
    return;
  }

  await loadChatConversations(false);

  const pendingUser = window.mlPendingChatUser;
  if (pendingUser) {
    window.mlPendingChatUser = null;
    let conversation = mlChatState.conversations.find(c => String(c.user_id) === String(pendingUser));

    if (!conversation) {
      const created = await api("createConversation", { other_user: pendingUser });
      if (!created?.ok) {
        toast(created?.error || "Não foi possível abrir a conversa.");
        return;
      }
      await loadChatConversations(false);
      conversation = mlChatState.conversations.find(c => String(c.id) === String(created.conversation_id))
        || mlChatState.conversations.find(c => String(c.user_id) === String(pendingUser));
    }

    if (conversation) await selectChatConversation(conversation.id);
    return;
  }

  if (mlChatState.activeId && mlChatState.conversations.some(c => String(c.id) === String(mlChatState.activeId))) {
    await selectChatConversation(mlChatState.activeId);
  }
}

async function loadChatConversations(keepActive = true) {
  const response = await api("listConversations");
  if (!response?.ok) {
    const host = $("#chatConversationList");
    if (host) host.innerHTML = `<div class="chat-empty-small">Não foi possível carregar as conversas.</div>`;
    return [];
  }

  mlChatState.conversations = Array.isArray(response.conversations) ? response.conversations : [];
  mlChatState.conversations.sort((a, b) => {
    const ad = new Date(a.last_at || a.created_at || 0).getTime() || 0;
    const bd = new Date(b.last_at || b.created_at || 0).getTime() || 0;
    return bd - ad;
  });

  if (!keepActive && !mlChatState.conversations.some(c => String(c.id) === String(mlChatState.activeId))) {
    mlChatState.activeId = null;
  }

  renderChatConversationList();
  return mlChatState.conversations;
}

function renderChatConversationList() {
  const host = $("#chatConversationList");
  if (!host) return;

  if (!mlChatState.conversations.length) {
    host.innerHTML = `
      <div class="chat-empty-small">
        Nenhuma conversa ainda.<br>
        Vá em <b>Pessoas</b> e clique em <b>Conversar</b> ao lado de um amigo.
      </div>`;
    return;
  }

  host.innerHTML = mlChatState.conversations.map(conversation => {
    const active = String(conversation.id) === String(mlChatState.activeId);
    const unread = Number(conversation.unread_count || 0);
    return `
      <button class="chat-conversation-item ${active ? "active" : ""}" onclick="selectChatConversation('${conversation.id}')">
        <div class="chat-avatar">${mlChatAvatar(conversation.name)}</div>
        <div class="chat-conversation-copy">
          <div class="chat-conversation-topline">
            <b>${escapeHtml(conversation.name || "Usuário")}</b>
            <span>${mlChatTime(conversation.last_at || conversation.created_at)}</span>
          </div>
          <div class="chat-conversation-preview">
            <span>${escapeHtml(conversation.last_message || "Conversa iniciada")}</span>
            ${unread ? `<strong class="chat-unread">${unread > 99 ? "99+" : unread}</strong>` : ""}
          </div>
        </div>
      </button>`;
  }).join("");
}

function openChat(friendId) {
  window.mlPendingChatUser = String(friendId);
  show("Chats");
}

async function selectChatConversation(conversationId) {
  mlChatState.activeId = String(conversationId);
  renderChatConversationList();

  const conversation = mlChatState.conversations.find(c => String(c.id) === String(conversationId));
  const panel = $("#chatMainPanel");
  if (!conversation || !panel) return;

  panel.innerHTML = `
    <div class="chat-header-modern">
      <div class="chat-avatar large">${mlChatAvatar(conversation.name)}</div>
      <div>
        <h3>${escapeHtml(conversation.name || "Usuário")}</h3>
        <div class="chat-presence"><span></span> Amigo no MetaLife</div>
      </div>
    </div>
    <div id="chatMessages" class="chat-messages-modern">
      <div class="chat-loading">Carregando mensagens...</div>
    </div>
    <div class="chat-composer-modern">
      <textarea id="chatText" rows="1" maxlength="3000" placeholder="Escreva uma mensagem..."></textarea>
      <button id="chatSendButton" class="chat-send-button" onclick="sendMsg()" title="Enviar mensagem">➤</button>
    </div>`;

  const input = $("#chatText");
  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMsg();
      }
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });
    input.focus();
  }

  await loadChatMessages(true);
  mlStartChatPolling();
}

function mlStartChatPolling() {
  mlStopChatPolling();
  let polling = false;
  mlChatState.pollTimer = setInterval(async () => {
    if (currentPage !== "Chats" || !mlChatState.activeId) {
      mlStopChatPolling();
      return;
    }
    if (document.hidden || polling) return;
    polling = true;
    try {
      await loadChatMessages(false);
    } finally { polling = false; }
  }, 3500);
}

async function loadChatMessages(scrollToBottom = false) {
  if (document.hidden || currentPage !== "Chats" || !mlChatState.activeId || mlChatState.loadingMessages) return;
  mlChatState.loadingMessages = true;
  const conversationId = String(mlChatState.activeId);
  const previousIds = new Set(mlChatState.messages.map(message => String(message.id)));
  try {
    const response = await api("listMessages", { conversa_id: conversationId });
    if (String(mlChatState.activeId) !== conversationId || currentPage !== "Chats") return;
    if (!response?.ok) {
      const host = $("#chatMessages");
      if (host) host.innerHTML = `<div class="chat-loading">Não foi possível carregar as mensagens.</div>`;
      return;
    }

    const nextMessages = Array.isArray(response.messages) ? response.messages : [];
    const incoming = nextMessages.filter(message => String(message.user_id) !== mlMyUserId() && !previousIds.has(String(message.id)));
    if (!scrollToBottom && incoming.length) {
      const conversation = mlChatState.conversations.find(item => String(item.id) === conversationId);
      mlNotifyNewMessage(conversation, incoming.at(-1).text, incoming.length);
    }
    if (mlChatState.activeId) {
      mlChatState.unreadSnapshot[String(mlChatState.activeId)] = 0;
      const conversation = mlChatState.conversations.find(item => String(item.id) === conversationId);
      if (conversation) conversation.unread_count = 0;
      mlUpdateChatUnreadBadge(mlChatState.conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0));
    }
    const changed = JSON.stringify(nextMessages.map(m => [m.id, m.read])) !== JSON.stringify(mlChatState.messages.map(m => [m.id, m.read]));
    mlChatState.messages = nextMessages;
    if (changed || scrollToBottom) renderChatMessages(scrollToBottom);
  } finally {
    mlChatState.loadingMessages = false;
  }
}

function renderChatMessages(forceBottom = false) {
  const host = $("#chatMessages");
  if (!host) return;
  const wasNearBottom = host.scrollHeight - host.scrollTop - host.clientHeight < 100;
  const myId = mlMyUserId();

  if (!mlChatState.messages.length) {
    host.innerHTML = `
      <div class="chat-first-message">
        <div class="chat-empty-icon">👋</div>
        <b>Comece a conversa</b>
        <span>Envie a primeira mensagem para seu amigo.</span>
      </div>`;
    return;
  }

  let lastDay = "";
  host.innerHTML = mlChatState.messages.map(message => {
    const day = mlChatDay(message.created_at);
    const divider = day !== lastDay ? `<div class="chat-day-divider"><span>${day}</span></div>` : "";
    lastDay = day;
    const mine = String(message.user_id) === myId;
    return `${divider}
      <div class="chat-message-row ${mine ? "mine" : "theirs"}">
        <div class="chat-bubble ${mine ? "mine" : "theirs"}">
          <div class="chat-message-text">${escapeHtml(message.text || "").replace(/\n/g, "<br>")}</div>
          <div class="chat-message-meta">
            <span>${mlChatTime(message.created_at)}</span>
            ${mine ? `<span class="chat-check ${message.read ? "read" : ""}">${message.read ? "✓✓" : "✓"}</span>` : ""}
          </div>
        </div>
      </div>`;
  }).join("");

  if (forceBottom || wasNearBottom) host.scrollTop = host.scrollHeight;
}

async function sendMsg() {
  const input = $("#chatText");
  const button = $("#chatSendButton");
  const text = input?.value?.trim();
  if (!text || !mlChatState.activeId) return;

  input.disabled = true;
  if (button) button.disabled = true;

  const response = await api("sendMessage", {
    conversa_id: mlChatState.activeId,
    texto: text
  });

  input.disabled = false;
  if (button) button.disabled = false;

  if (!response?.ok) {
    toast(response?.error || "Não foi possível enviar a mensagem.");
    input.focus();
    return;
  }

  input.value = "";
  input.style.height = "auto";
  await loadChatMessages(true);
  await loadChatConversations(true);
  input.focus();
}

/* =========================
   MODAIS
========================= */

function openModal(title, html) {
  $("#modalTitle").textContent =
    title;

  $("#modalBody").innerHTML =
    html;

  $("#modalBackdrop")
    .classList.remove("hidden");
}

function closeModal() {
  $("#modalBackdrop")
    .classList.add("hidden");
}

$("#modalClose").onclick =
  closeModal;

$("#modalBackdrop").onclick =
  event => {
    if (
      event.target.id ===
      "modalBackdrop"
    ) {
      closeModal();
    }
  };

$("#quickAddBtn").onclick =
  openQuickAdd;

/* =========================
   LOGOUT
========================= */

$("#logoutBtn").onclick =
  async () => {
    try { await window.mlPwaDisconnect?.(); } catch (_) { toast("Não foi possível cancelar as notificações. Tente sair novamente com internet."); return; }
    window.mlPwaClear?.();
    mlStopMessageNotifications();
    mlStopChatPolling();
    localStorage.removeItem("ml_user_id");
    localStorage.removeItem(
      "ml_token"
    );

    state = Store.defaults();
    clearCharts();
    $("#content").replaceChildren();
    $("#userBadge").replaceChildren();
    $("#modalBody").replaceChildren();
    $("#modalBackdrop").classList.add("hidden");
    document.querySelector("#saveWarning")?.remove();
    $("#loginPassword").value = "";
    $("#app")
      .classList.add("hidden");

    $("#authScreen")
      .classList.remove("hidden");
  };

/* =========================
   LOGIN / CADASTRO
========================= */

document
  .querySelectorAll(
    "[data-auth-tab]"
  )
  .forEach(button => {
    button.onclick = () => {
      document
        .querySelectorAll(
          "[data-auth-tab]"
        )
        .forEach(item =>
          item.classList.remove(
            "active"
          )
        );

      button.classList.add(
        "active"
      );

      const register =
        button.dataset.authTab ===
        "register";

      $("#loginForm")
        .classList.toggle(
          "hidden",
          register
        );

      $("#registerForm")
        .classList.toggle(
          "hidden",
          !register
        );
    };
  });

/* =========================
   DEMO
========================= */

$("#demoBtn").onclick =
  async () => {
    try { await window.mlPwaDisconnect?.(); } catch (_) { toast("Conecte-se para encerrar as notificações antes da demonstração."); return; }
    window.mlPwaClear?.();
    mlStopMessageNotifications();
    mlStopChatPolling();
    localStorage.removeItem("ml_user_id");
    localStorage.removeItem(
      "ml_token"
    );

    state = Store.load();

    boot();
  };

/* =========================
   LOGIN REAL
========================= */

$("#loginForm").onsubmit =
  async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.loading === 'true') return;
    form.dataset.loading = 'true';
    form.setAttribute('aria-busy', 'true');
    const controls = Array.from(document.querySelectorAll('#authScreen button, #authScreen input'));
    const disabledBefore = controls.map(control => control.disabled);
    controls.forEach(control => control.disabled = true);
    const submit = form.querySelector('button');
    const previousLabel = submit.textContent;
    submit.textContent = 'Entrando…';
    const overlay = document.createElement('div');
    overlay.className = 'login-loading-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="login-loading-card"><span class="login-loading-spinner" aria-hidden="true"></span><strong>Entrando no MetaLife…</strong><span>Aguarde enquanto preparamos seu painel.</span></div>';
    document.body.appendChild(overlay);
    try {
    mlArmBrowserNotifications();

    const response =
      await api(
        "login",
        {
          email:
            $("#loginEmail").value,

          password:
            $("#loginPassword").value
        }
      );

    if (response?.ok) {
      localStorage.setItem(
        "ml_token",
        response.token
      );

      state.user =
        response.user;

      const loggedUserId =
        response.user_id ||
        response.user?.id ||
        response.user?.user_id;

      if (loggedUserId) {
        localStorage.setItem("ml_user_id", String(loggedUserId));
      }

      state = Store.load();
      state.user = response.user;
      saveLocal();

      toast("Login realizado.");

      await boot();

      return;
    }

    toast(
      response?.error ||
      "Falha no login."
    );
    } catch (error) {
      toast('Não foi possível concluir a entrada. Tente novamente.');
    } finally {
      overlay.remove();
      submit.textContent = previousLabel;
      controls.forEach((control, index) => control.disabled = disabledBefore[index]);
      form.dataset.loading = 'false';
      form.removeAttribute('aria-busy');
    }
  };

/* =========================
   CADASTRO REAL
========================= */

$("#registerForm").onsubmit =
  async event => {
    event.preventDefault();

    const payload = {
      nome:
        $("#regName").value,

      email:
        $("#regEmail").value,

      password:
        $("#regPassword").value
    };

    const response =
      await api(
        "register",
        payload
      );

    if (response?.ok) {
      toast(
        "Conta criada. Faça login."
      );

      document
        .querySelector(
          '[data-auth-tab="login"]'
        )
        .click();

      $("#loginEmail").value =
        payload.email;

      return;
    }

    toast(
      response?.error ||
      "Erro ao cadastrar."
    );
  };

/* =========================
   AUTO LOGIN
========================= */

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    if (isLogged()) {
      await boot();
    }
  }
);

/* =========================================================
   METALIFE V4 — CAMADA DE EVOLUÇÃO
   Meta → Plano → Meu Dia → Resultado → Revisão
   ========================================================= */

function mlEsc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mlArray(value) {
  return Array.isArray(value) ? value : [];
}

function mlPlanActions(goal) {
  if (Array.isArray(goal?.plan?.actions) && goal.plan.actions.length) {
    return goal.plan.actions;
  }
  if (goal?.plan && (goal.plan.title || goal.plan.target)) {
    return [{
      id: goal.plan.id || ("ACT_" + goal.id),
      title: goal.plan.title || goal.name,
      category: goal.category || "Meta",
      target: Number(goal.plan.target) || 1,
      unit: goal.plan.unit || "",
      time: goal.plan.time || "",
      frequency: goal.plan.frequency || "daily",
      days: goal.plan.days || [],
      active: true
    }];
  }
  return [];
}

function mlTodayDayIndex() {
  return new Date().getDay();
}

function mlActionRunsToday(action) {
  if (action?.active === false) return false;
  const day = mlTodayDayIndex();
  const frequency = action?.frequency || "daily";
  if (frequency === "daily") return true;
  if (frequency === "weekdays") return day >= 1 && day <= 5;
  if (frequency === "weekends") return day === 0 || day === 6;
  if (frequency === "custom") return mlArray(action.days).map(Number).includes(day);
  return true;
}

function mlWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function mlDateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function mlGoalForecast(goal) {
  const start = Number(goal?.startValue);
  const current = Number(goal?.currentValue);
  const target = Number(goal?.targetValue);
  if (![start,current,target].every(Number.isFinite) || start === target) return null;
  const startDate = goal?.startDate ? new Date(goal.startDate + "T12:00") : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return null;
  const elapsedDays = Math.max(1, Math.round((Date.now() - startDate.getTime()) / 86400000));
  const moved = Math.abs(current - start);
  if (moved <= 0) return null;
  const rate = moved / elapsedDays;
  const remaining = Math.abs(target - current);
  const daysLeft = Math.ceil(remaining / rate);
  const forecast = new Date();
  forecast.setDate(forecast.getDate() + daysLeft);
  return { daysLeft, date: forecast, rate };
}

function mlGoalExpectedValue(goal) {
  if (!goal?.startDate || !goal?.deadline) return null;
  const startDate = new Date(goal.startDate + "T12:00");
  const endDate = new Date(goal.deadline + "T12:00");
  const total = endDate - startDate;
  if (total <= 0) return null;
  const passed = Math.max(0, Math.min(total, Date.now() - startDate.getTime()));
  const fraction = passed / total;
  const start = Number(goal.startValue) || 0;
  const target = Number(goal.targetValue) || 0;
  return start + (target - start) * fraction;
}

function mlMilestoneProgress(goal) {
  const current = Number(goal.currentValue);
  const target = Number(goal.targetValue);
  const start = Number(goal.startValue);
  const milestones = mlArray(goal.milestones).map(Number).filter(Number.isFinite);
  if (!milestones.length) return null;
  const decreasing = target < start;
  const pending = milestones
    .filter(v => decreasing ? current > v : current < v)
    .sort((a,b) => decreasing ? b-a : a-b);
  return pending[0] ?? target;
}

function mlMetaLifeScore() {
  const today = dayItems();
  const dailyScore = today.length
    ? Math.round(today.reduce((s, i) => s + pct(Number(i.value)||0, Number(i.target)||1), 0) / today.length)
    : 0;
  const habits = mlArray(state.habits);
  const habitScore = habits.length
    ? Math.round(habits.reduce((s,h) => s + Math.min(100, (Number(h.streak)||0) * 10), 0) / habits.length)
    : dailyScore;
  const checkin = state.checkins?.[iso()];
  const checkinScore = checkin
    ? Math.round(((Number(checkin.energy)||3) + (Number(checkin.mood)||3)) / 10 * 100)
    : dailyScore;
  return Math.round(dailyScore * 0.6 + habitScore * 0.2 + checkinScore * 0.2);
}

function mlEnsureState() {
  state.goals = mlArray(state.goals);
  state.daily = mlArray(state.daily);
  state.weight = mlArray(state.weight);
  state.tasks = mlArray(state.tasks);
  state.habits = mlArray(state.habits);
  state.workouts = mlArray(state.workouts);
  state.checkins ||= {};
  state.weeklyReviews ||= [];
}

const mlOriginalBoot = boot;
boot = async function() {
  mlEnsureState();
  await mlOriginalBoot();
  mlEnsureState();
};

/* ---------- META: múltiplas ações, marcos e dias personalizados ---------- */

goalModal = function(goalId = null) {
  mlEnsureState();
  const goal = state.goals.find(item => item.id === goalId) || null;
  const editing = !!goal;
  const trackingMode = goal?.trackingMode || (goal?.plan ? "daily" : "manual");
  const actions = mlPlanActions(goal);
  const milestones = mlArray(goal?.milestones).join(", ");

  openModal(editing ? "Editar meta" : "Nova meta", `
    <input type="hidden" id="goalEditId" value="${mlEsc(goal?.id || "")}">
    <div class="form-grid">
      <div class="field"><label>Nome da meta</label><input id="goalName" value="${mlEsc(goal?.name || "")}" placeholder="Ex.: Chegar a 80 kg"></div>
      <div class="field"><label>Categoria</label><select id="goalCategory">
        ${["Saúde","Peso","Treino","Dieta","Trabalho","Financeiro","Estudos","Pessoal","Outro"].map(c => `<option ${goal?.category===c?"selected":""}>${c}</option>`).join("")}
      </select></div>
      <div class="field"><label>Valor inicial</label><input id="goalStartValue" type="number" step="0.01" value="${goal?.startValue ?? ""}"></div>
      <div class="field"><label>Valor atual</label><input id="goalCurrentValue" type="number" step="0.01" value="${goal?.currentValue ?? ""}"></div>
      <div class="field"><label>Valor alvo</label><input id="goalTargetValue" type="number" step="0.01" value="${goal?.targetValue ?? ""}"></div>
      <div class="field"><label>Unidade</label><input id="goalUnit" value="${mlEsc(goal?.unit || "")}" placeholder="kg, R$, horas..."></div>
      <div class="field"><label>Data de início</label><input id="goalStartDate" type="date" value="${goal?.startDate || iso()}"></div>
      <div class="field"><label>Prazo final</label><input id="goalDeadline" type="date" value="${goal?.deadline || ""}"></div>
      <div class="field"><label>Marcos intermediários</label><input id="goalMilestones" value="${mlEsc(milestones)}" placeholder="Ex.: 88, 85, 82"></div>
    </div>

    <div class="card" style="margin:20px 0">
      <div class="section-head" style="margin-top:0"><div><h2>Plano da meta</h2><div class="muted">Crie várias ações. Cada uma pode ter frequência e horário próprios.</div></div></div>
      <div class="field"><label>Acompanhamento</label><select id="goalTrackingMode" onchange="toggleGoalTrackingFields()">
        <option value="manual" ${trackingMode==="manual"?"selected":""}>Manual</option>
        <option value="daily" ${trackingMode==="daily"?"selected":""}>Pelo Meu Dia</option>
      </select></div>
      <div id="goalTrackingFields" style="display:${trackingMode==="daily"?"block":"none"};margin-top:16px">
        <div id="goalActions"></div>
        <button type="button" class="chip-btn" onclick="mlAddGoalActionRow()">+ Adicionar ação ao plano</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="primary" onclick="mlSaveGoalForm()">${editing?"Salvar alterações":"Criar meta"}</button>
      ${editing?`<button class="secondary" onclick="deleteGoalItem('${goal.id}')">Excluir meta</button>`:""}
    </div>
  `);

  setTimeout(() => {
    if (trackingMode === "daily") {
      (actions.length ? actions : [{title:"",category:goal?.category||"Saúde",target:1,unit:"",time:"",frequency:"daily",days:[],active:true}])
        .forEach(a => mlAddGoalActionRow(a));
    }
  }, 0);
};

function mlAddGoalActionRow(action = {}) {
  const host = $("#goalActions");
  if (!host) return;
  const id = action.id || ("ACT_" + uid());
  const days = mlArray(action.days).map(Number);
  const row = document.createElement("div");
  row.className = "card ml-goal-action";
  row.dataset.actionId = id;
  row.style.marginBottom = "12px";
  row.innerHTML = `
    <div class="section-head" style="margin-top:0"><b>Ação do plano</b><button type="button" class="chip-btn" onclick="this.closest('.ml-goal-action').remove()">Remover</button></div>
    <div class="form-grid">
      <div class="field"><label>Ação</label><input class="ga-title" value="${mlEsc(action.title||"")}" placeholder="Ex.: Cardio"></div>
      <div class="field"><label>Categoria</label><select class="ga-category">${["Dieta","Treino","Cardio","Água","Trabalho","Tarefa","Estudos","Outro"].map(c=>`<option ${action.category===c?"selected":""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label>Meta</label><input class="ga-target" type="number" step="0.01" value="${action.target ?? 1}"></div>
      <div class="field"><label>Unidade</label><input class="ga-unit" value="${mlEsc(action.unit||"")}" placeholder="min, L, páginas..."></div>
      <div class="field"><label>Horário</label><input class="ga-time" type="time" value="${action.time||""}"></div>
      <div class="field"><label>Frequência</label><select class="ga-frequency" onchange="mlToggleCustomDays(this)">
        <option value="daily" ${action.frequency==="daily"||!action.frequency?"selected":""}>Todos os dias</option>
        <option value="weekdays" ${action.frequency==="weekdays"?"selected":""}>Segunda a sexta</option>
        <option value="weekends" ${action.frequency==="weekends"?"selected":""}>Fim de semana</option>
        <option value="custom" ${action.frequency==="custom"?"selected":""}>Dias personalizados</option>
      </select></div>
    </div>
    <div class="ga-days" style="display:${action.frequency==="custom"?"flex":"none"};gap:8px;flex-wrap:wrap;margin-top:8px">
      ${[[1,"Seg"],[2,"Ter"],[3,"Qua"],[4,"Qui"],[5,"Sex"],[6,"Sáb"],[0,"Dom"]].map(([n,l])=>`<label class="pill"><input type="checkbox" value="${n}" ${days.includes(n)?"checked":""}> ${l}</label>`).join("")}
    </div>
  `;
  host.appendChild(row);
}

function mlToggleCustomDays(select) {
  const row = select.closest(".ml-goal-action");
  const days = row?.querySelector(".ga-days");
  if (days) days.style.display = select.value === "custom" ? "flex" : "none";
}

function mlReadGoalActions() {
  return [...document.querySelectorAll(".ml-goal-action")].map(row => ({
    id: row.dataset.actionId || ("ACT_" + uid()),
    title: row.querySelector(".ga-title")?.value.trim() || "Atividade",
    category: row.querySelector(".ga-category")?.value || "Meta",
    target: Number(row.querySelector(".ga-target")?.value) || 1,
    unit: row.querySelector(".ga-unit")?.value.trim() || "",
    time: row.querySelector(".ga-time")?.value || "",
    frequency: row.querySelector(".ga-frequency")?.value || "daily",
    days: [...row.querySelectorAll(".ga-days input:checked")].map(i => Number(i.value)),
    active: true
  }));
}

async function mlSaveGoalForm() {
  mlEnsureState();
  const id = $("#goalEditId")?.value || uid();
  const existing = state.goals.find(g => g.id === id);
  const name = $("#goalName")?.value.trim();
  if (!name) return toast("Informe o nome da meta.");
  const trackingMode = $("#goalTrackingMode")?.value || "manual";
  const actions = trackingMode === "daily" ? mlReadGoalActions() : [];
  const milestones = ($("#goalMilestones")?.value || "")
    .split(/[,;]+/).map(v => Number(v.trim().replace(",","."))).filter(Number.isFinite);

  const goal = {
    ...(existing || {}),
    id, name,
    category: $("#goalCategory")?.value || "Outro",
    startValue: Number($("#goalStartValue")?.value) || 0,
    currentValue: Number($("#goalCurrentValue")?.value) || 0,
    targetValue: Number($("#goalTargetValue")?.value) || 0,
    unit: $("#goalUnit")?.value.trim() || "",
    startDate: $("#goalStartDate")?.value || iso(),
    deadline: $("#goalDeadline")?.value || "",
    milestones,
    trackingMode,
    plan: {
      id: existing?.plan?.id || ("PLAN_" + id),
      actions
    },
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const idx = state.goals.findIndex(g => g.id === id);
  if (idx >= 0) state.goals[idx] = goal; else state.goals.push(goal);

  // Remove somente ações futuras/hoje vinculadas a ações que deixaram de existir.
  const activeIds = new Set(actions.map(a => a.id));
  state.daily = state.daily.filter(item => {
    if (item.goal_id !== id) return true;
    if (normalizeDate(item.date) < iso()) return true;
    return activeIds.has(item.plan_action_id || item.plan_id);
  });

  saveLocal();
  if (isLogged()) {
    const response = await api("saveGoal", { item: goal });
    if (!response?.ok) return toast(response?.error || "Erro ao salvar a meta.");
  }
  await ensureGoalDailyItems();
  closeModal();
  renderGoals();
  toast(existing ? "Meta atualizada." : "Meta criada.");
}

ensureGoalDailyItems = async function() {
  mlEnsureState();
  const today = iso();
  for (const goal of state.goals) {
    if (goal.trackingMode !== "daily") continue;
    if (goal.startDate && today < normalizeDate(goal.startDate)) continue;
    if (goal.deadline && today > normalizeDate(goal.deadline)) continue;
    for (const action of mlPlanActions(goal)) {
      if (!mlActionRunsToday(action)) continue;
      const actionId = action.id || goal.plan?.id || ("ACT_" + goal.id);
      const existing = state.daily.find(item =>
        normalizeDate(item.date) === today && item.goal_id === goal.id &&
        (item.plan_action_id === actionId || item.plan_id === actionId)
      );
      if (existing) continue;
      const dailyItem = {
        id: uid(), date: today,
        category: action.category || goal.category || "Meta",
        title: action.title || goal.name,
        target: Number(action.target) || 1,
        value: 0, unit: action.unit || "", time: action.time || "",
        done: false, goal_id: goal.id,
        plan_id: actionId, plan_action_id: actionId,
        source: "goal", createdAt: new Date().toISOString()
      };
      state.daily.push(dailyItem);
      if (isLogged()) await api("saveDaily", { item: dailyItem });
    }
  }
  saveLocal();
};

const mlBaseRenderGoals = renderGoals;
renderGoals = function() {
  mlEnsureState();
  const goals = state.goals;
  $("#content").innerHTML = `
    <div class="section-head"><div><h2>Suas metas</h2><div class="muted">Meta → plano → execução diária → resultado.</div></div><button class="primary" onclick="goalModal()">+ Nova meta</button></div>
    ${goals.length ? `<div class="grid cols-2">${goals.map(goal => {
      const progressValue = calculateGoalProgress(goal);
      const status = calculateGoalStatus(goal);
      const forecast = mlGoalForecast(goal);
      const expected = mlGoalExpectedValue(goal);
      const nextMilestone = mlMilestoneProgress(goal);
      const actions = mlPlanActions(goal);
      return `<div class="card goal-card">
        <div class="goal-top"><div><div class="goal-title">${mlEsc(goal.name)}</div><div class="goal-meta">${mlEsc(goal.category||"")}</div></div><span class="badge">${status.text}</span></div>
        <div class="kpi"><div><div class="metric-label">Atual</div><strong>${goal.currentValue ?? 0} ${mlEsc(goal.unit||"")}</strong></div><div style="text-align:right"><div class="metric-label">Alvo</div><strong>${goal.targetValue ?? 0} ${mlEsc(goal.unit||"")}</strong></div></div>
        <div class="progress"><span style="width:${progressValue}%"></span></div>
        <div style="display:flex;justify-content:space-between;margin-top:8px"><span class="muted">${progressValue}% concluído</span>${goal.deadline?`<span class="muted">até ${new Date(goal.deadline+"T12:00").toLocaleDateString("pt-BR")}</span>`:""}</div>
        ${expected !== null ? `<div class="card" style="margin-top:12px;padding:12px"><div class="metric-label">Valor esperado hoje</div><b>${expected.toFixed(1)} ${mlEsc(goal.unit||"")}</b></div>` : ""}
        ${forecast ? `<div class="muted" style="margin-top:10px">Previsão no ritmo atual: <b>${forecast.date.toLocaleDateString("pt-BR")}</b> (${forecast.daysLeft} dias)</div>` : ""}
        ${nextMilestone !== null ? `<div class="muted" style="margin-top:6px">Próximo marco: <b>${nextMilestone} ${mlEsc(goal.unit||"")}</b></div>` : ""}
        ${actions.length ? `<div style="margin-top:14px"><div class="metric-label">Plano</div>${actions.map(a=>`<div class="profile-row" style="padding:8px 0"><div style="flex:1"><b>${mlEsc(a.title)}</b><div class="muted">${a.target} ${mlEsc(a.unit||"")} · ${a.frequency==="custom"?"dias escolhidos":a.frequency}</div></div><span class="pill">${a.time||"✓"}</span></div>`).join("")}</div>`:""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="chip-btn" onclick="goalModal('${goal.id}')">Editar</button><button class="chip-btn" onclick="deleteGoalItem('${goal.id}')">Excluir</button></div>
      </div>`;
    }).join("")}</div>` : `<div class="card"><h3>Nenhuma meta criada</h3><div class="muted">Crie uma meta e conecte ações ao Meu Dia.</div></div>`}
  `;
};

/* ---------- CHECK-IN diário + evolução no Meu Dia ---------- */

function mlCheckinModal() {
  state.checkins ||= {};
  const c = state.checkins[iso()] || {};
  openModal("Check-in de hoje", `
    <div class="form-grid">
      <div class="field"><label>Energia (1–5)</label><input id="ciEnergy" type="number" min="1" max="5" value="${c.energy||3}"></div>
      <div class="field"><label>Humor (1–5)</label><input id="ciMood" type="number" min="1" max="5" value="${c.mood||3}"></div>
      <div class="field"><label>Sono (horas)</label><input id="ciSleep" type="number" min="0" max="24" step="0.1" value="${c.sleep||""}"></div>
      <div class="field"><label>Peso (opcional)</label><input id="ciWeight" type="number" step="0.1" value="${c.weight||""}"></div>
    </div>
    <div class="field"><label>Observação</label><textarea id="ciNote" rows="3" placeholder="Como foi o seu dia?">${mlEsc(c.note||"")}</textarea></div>
    <button class="primary" onclick="mlSaveCheckin()">Salvar check-in</button>
  `);
}

async function mlSaveCheckin() {
  state.checkins ||= {};
  const weight = Number($("#ciWeight")?.value);
  state.checkins[iso()] = {
    date: iso(), energy: Number($("#ciEnergy")?.value)||3,
    mood: Number($("#ciMood")?.value)||3,
    sleep: Number($("#ciSleep")?.value)||0,
    weight: Number.isFinite(weight) && weight > 0 ? weight : null,
    note: $("#ciNote")?.value.trim() || ""
  };
  if (weight > 0) {
    const existing = state.weight.find(w => normalizeDate(w.date) === iso());
    if (existing) existing.value = weight;
    else state.weight.push({id:uid(),date:iso(),value:weight,category:"Peso",title:"Peso corporal",unit:"kg"});
    const weightGoal = state.goals.find(g => g.category === "Peso" || String(g.unit).toLowerCase()==="kg");
    if (weightGoal) {
      weightGoal.currentValue = weight;
      weightGoal.updatedAt = new Date().toISOString();
      if (isLogged()) await api("saveGoal", { item: weightGoal });
    }
    if (isLogged()) await api("saveWeight", { item: state.weight.find(w => normalizeDate(w.date) === iso()) });
  }
  const savedCheckin = state.checkins[iso()];
  saveLocal();

  if (isLogged()) {
    const response = await api("saveCheckin", { item: savedCheckin });
    if (!response?.ok) {
      console.warn("Não foi possível sincronizar o check-in:", response);
    }
  }

  closeModal(); renderToday(); toast("Check-in salvo.");
}

const mlBaseRenderToday = renderToday;
renderToday = function() {
  mlBaseRenderToday();
  mlEnsureState();
  const c = state.checkins?.[iso()];
  const score = mlMetaLifeScore();
  const goalSummary = state.goals.filter(g => calculateGoalProgress(g) < 100).slice(0,2);
  const host = $("#content");
  if (!host) return;
  const block = document.createElement("div");
  block.innerHTML = `
    <div class="section-head"><h2>Direção do dia</h2><button class="chip-btn" onclick="mlCheckinModal()">${c?"Editar check-in":"Fazer check-in"}</button></div>
    <div class="grid cols-3">
      <div class="card"><div class="metric-label">MetaLife Score</div><div class="big">${score}%</div><div class="muted">execução + hábitos + check-in</div></div>
      <div class="card"><div class="metric-label">Energia / Humor</div><div class="big">${c?`${c.energy}/5 · ${c.mood}/5` : "—"}</div><div class="muted">${c?.sleep?`${c.sleep} h de sono`:"registre seu check-in"}</div></div>
      <div class="card"><div class="metric-label">Metas ativas</div><div class="big">${state.goals.filter(g=>calculateGoalProgress(g)<100).length}</div><div class="muted">ações de hoje conectadas às metas</div></div>
    </div>
    ${goalSummary.length?`<div class="grid cols-2" style="margin-top:16px">${goalSummary.map(g=>`<div class="card"><div class="metric-label">🎯 ${mlEsc(g.name)}</div><div class="big">${calculateGoalProgress(g)}%</div><div class="progress"><span style="width:${calculateGoalProgress(g)}%"></span></div></div>`).join("")}</div>`:""}
  `;
  host.prepend(...block.children);
};

/* ---------- INSIGHTS: score, aderência semanal e revisão ---------- */

function mlWeeklyStats() {
  mlEnsureState();
  const start = mlWeekStart();
  const end = new Date(start); end.setDate(end.getDate()+6); end.setHours(23,59,59,999);
  const weekItems = state.daily.filter(item => {
    const d = new Date(normalizeDate(item.date)+"T12:00");
    return d >= start && d <= end;
  });
  const done = weekItems.filter(i => Number(i.value) >= Number(i.target)).length;
  const adherence = weekItems.length ? Math.round(done / weekItems.length * 100) : 0;
  return { start, end, items: weekItems, done, adherence };
}

function mlWeeklyReviewModal() {
  const stats = mlWeeklyStats();
  openModal("Revisão semanal", `
    <div class="grid cols-3">
      <div class="card"><div class="metric-label">Aderência</div><div class="big">${stats.adherence}%</div></div>
      <div class="card"><div class="metric-label">Ações concluídas</div><div class="big">${stats.done}/${stats.items.length}</div></div>
      <div class="card"><div class="metric-label">MetaLife Score</div><div class="big">${mlMetaLifeScore()}%</div></div>
    </div>
    <div class="field"><label>O que funcionou?</label><textarea id="wrWins" rows="3"></textarea></div>
    <div class="field"><label>O que atrapalhou?</label><textarea id="wrBlocks" rows="3"></textarea></div>
    <div class="field"><label>Ajuste para a próxima semana</label><textarea id="wrNext" rows="3"></textarea></div>
    <button class="primary" onclick="mlSaveWeeklyReview()">Salvar revisão</button>
  `);
}

async function mlSaveWeeklyReview() {
  state.weeklyReviews ||= [];
  const stats = mlWeeklyStats();
  const weekStart = mlDateKey(stats.start);
  const previous = state.weeklyReviews.find(item => item.weekStart === weekStart);
  const review = {
    id: previous?.id || `WR_${weekStart}`,
    weekStart,
    date: weekStart,
    adherence: stats.adherence,
    score: mlMetaLifeScore(),
    wins: $("#wrWins")?.value.trim()||"",
    blocks: $("#wrBlocks")?.value.trim()||"",
    next: $("#wrNext")?.value.trim()||"",
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (previous) Object.assign(previous, review);
  else state.weeklyReviews.push(review);

  saveLocal();

  if (isLogged()) {
    const response = await api("saveWeeklyReview", { item: review });
    if (!response?.ok) console.warn("Não foi possível sincronizar a revisão semanal:", response);
  }

  closeModal(); renderInsights(); toast("Revisão semanal salva.");
}

const mlBaseRenderInsights = renderInsights;
renderInsights = function() {
  mlBaseRenderInsights();
  mlEnsureState();
  const stats = mlWeeklyStats();
  const activeGoals = state.goals.filter(g => calculateGoalProgress(g) < 100);
  const host = $("#content");
  if (!host) return;
  const extra = document.createElement("div");
  extra.innerHTML = `
    <div class="section-head"><div><h2>Análise de direção</h2><div class="muted">Planejado x executado x resultado.</div></div><button class="chip-btn" onclick="mlWeeklyReviewModal()">Fazer revisão semanal</button></div>
    <div class="grid cols-3">
      <div class="card"><div class="metric-label">MetaLife Score</div><div class="big">${mlMetaLifeScore()}%</div></div>
      <div class="card"><div class="metric-label">Aderência da semana</div><div class="big">${stats.adherence}%</div><div class="muted">${stats.done}/${stats.items.length} ações</div></div>
      <div class="card"><div class="metric-label">Metas em andamento</div><div class="big">${activeGoals.length}</div></div>
    </div>
    ${activeGoals.length ? `<div class="grid cols-2" style="margin-top:16px">${activeGoals.map(g=>{const f=mlGoalForecast(g), exp=mlGoalExpectedValue(g);return `<div class="card"><div class="goal-title">${mlEsc(g.name)}</div><div class="muted" style="margin-top:6px">Atual: ${g.currentValue} ${mlEsc(g.unit||"")} ${exp!==null?`· esperado: ${exp.toFixed(1)} ${mlEsc(g.unit||"")}`:""}</div><div class="progress" style="margin-top:10px"><span style="width:${calculateGoalProgress(g)}%"></span></div>${f?`<div class="muted" style="margin-top:8px">Previsão: ${f.date.toLocaleDateString("pt-BR")}</div>`:""}</div>`}).join("")}</div>` : ""}
  `;
  host.prepend(...extra.children);
};

/* ---------- TREINO: PR, 1RM estimado e timer de descanso ---------- */

function mlExerciseStats(exercise) {
  const sets = mlArray(exercise?.sets);
  const valid = sets.filter(s => Number(s.kg)>0 && Number(s.reps)>0);
  const maxKg = valid.length ? Math.max(...valid.map(s=>Number(s.kg))) : 0;
  const best1rm = valid.length ? Math.max(...valid.map(s=>Number(s.kg)*(1+Number(s.reps)/30))) : 0;
  const volume = valid.reduce((sum,s)=>sum+Number(s.kg)*Number(s.reps),0);
  return { maxKg, best1rm, volume };
}

let mlRestTimerId = null;
let mlRestRemaining = 0;
function mlStartRestTimer(seconds = 90) {
  clearInterval(mlRestTimerId); mlRestRemaining = Number(seconds)||90;
  toast(`Descanso iniciado: ${mlRestRemaining}s`);
  mlRestTimerId = setInterval(() => {
    mlRestRemaining--;
    if (mlRestRemaining <= 0) { clearInterval(mlRestTimerId); mlRestTimerId=null; toast("Descanso concluído. Próxima série!"); }
  },1000);
}
function mlCancelRestTimer() { clearInterval(mlRestTimerId); mlRestTimerId=null; mlRestRemaining=0; toast("Timer cancelado."); }

const mlBaseRenderWorkout = renderWorkout;
renderWorkout = function() {
  mlBaseRenderWorkout();
  const workout = state.workouts?.[0];
  if (!workout || !$("#content")) return;
  const exercises = mlArray(workout.exercises);
  const best = exercises.map(e=>({name:e.name,...mlExerciseStats(e)})).sort((a,b)=>b.best1rm-a.best1rm)[0];
  const banner = document.createElement("div");
  banner.innerHTML = `
    <div class="section-head"><h2>Performance</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="chip-btn" onclick="mlStartRestTimer(60)">Descanso 60s</button><button class="chip-btn" onclick="mlStartRestTimer(90)">90s</button><button class="chip-btn" onclick="mlStartRestTimer(120)">120s</button></div></div>
    <div class="grid cols-3">
      <div class="card"><div class="metric-label">Melhor 1RM estimado</div><div class="big">${best?best.best1rm.toFixed(1):0} kg</div><div class="muted">${best?mlEsc(best.name):"sem dados"}</div></div>
      <div class="card"><div class="metric-label">PR de carga</div><div class="big">${best?best.maxKg:0} kg</div></div>
      <div class="card"><div class="metric-label">Timer</div><div class="big">${mlRestTimerId?`${mlRestRemaining}s`:"pronto"}</div><button class="chip-btn" onclick="mlCancelRestTimer()" style="margin-top:8px">Cancelar</button></div>
    </div>
  `;
  $("#content").prepend(...banner.children);
};

/* ---------- HÁBITOS: recorrência, frequência e resumo ---------- */

const mlBaseHabitModal = habitModal;
habitModal = function(id = null) {
  const habit = mlArray(state.habits).find(h=>h.id===id);
  openModal(habit?"Editar hábito":"Novo hábito", `
    <input type="hidden" id="habitEditId" value="${habit?.id||""}">
    <div class="form-grid">
      <div class="field"><label>Hábito</label><input id="habitTitle" value="${mlEsc(habit?.title||"")}" placeholder="Ex.: Ler"></div>
      <div class="field"><label>Meta</label><input id="habitTarget" value="${mlEsc(habit?.target||"")}" placeholder="Ex.: 20 min"></div>
      <div class="field"><label>Frequência</label><select id="habitFrequency"><option value="daily" ${habit?.frequency==="daily"||!habit?.frequency?"selected":""}>Diário</option><option value="weekdays" ${habit?.frequency==="weekdays"?"selected":""}>Seg–Sex</option><option value="weekends" ${habit?.frequency==="weekends"?"selected":""}>Fim de semana</option></select></div>
      <div class="field"><label>Horário</label><input id="habitTime" type="time" value="${habit?.time||""}"></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary" onclick="mlSaveHabitForm()">Salvar</button>${habit?`<button class="secondary" onclick="deleteHabitItem('${habit.id}')">Excluir</button>`:""}</div>
  `);
};

async function mlSaveHabitForm() {
  state.habits = mlArray(state.habits);
  const id = $("#habitEditId")?.value || uid();
  const existing = state.habits.find(h=>h.id===id);
  const item = {...(existing||{}),id,title:$("#habitTitle")?.value.trim()||"Novo hábito",target:$("#habitTarget")?.value.trim()||"1x",frequency:$("#habitFrequency")?.value||"daily",time:$("#habitTime")?.value||"",streak:Number(existing?.streak)||0,updatedAt:new Date().toISOString()};
  const idx=state.habits.findIndex(h=>h.id===id); if(idx>=0)state.habits[idx]=item;else state.habits.push(item);
  saveLocal(); if(isLogged()) await api("saveHabit",{item}); closeModal(); renderHabits(); toast("Hábito salvo.");
}

/* ---------- DIETA: macros e favoritos ---------- */

const mlBaseRenderDiet = renderDiet;
renderDiet = function() {
  mlBaseRenderDiet();
  const diet = state.diet;
  if (!diet || !$("#content")) return;
  const macros = diet.macros || {};
  const card = document.createElement("div");
  card.innerHTML = `
    <div class="section-head"><h2>Macros do dia</h2><button class="chip-btn" onclick="mlDietMacrosModal()">Editar macros</button></div>
    <div class="grid cols-4">
      ${[["Calorias",macros.calories,"kcal"],["Proteína",macros.protein,"g"],["Carboidratos",macros.carbs,"g"],["Gorduras",macros.fat,"g"]].map(([l,v,u])=>`<div class="card"><div class="metric-label">${l}</div><div class="big">${v||0} ${u}</div></div>`).join("")}
    </div>
  `;
  $("#content").prepend(...card.children);
};

function mlDietMacrosModal() {
  const m = state.diet?.macros || {};
  openModal("Metas de macros", `<div class="form-grid">
    <div class="field"><label>Calorias</label><input id="dmCalories" type="number" value="${m.calories||""}"></div>
    <div class="field"><label>Proteína (g)</label><input id="dmProtein" type="number" value="${m.protein||""}"></div>
    <div class="field"><label>Carboidratos (g)</label><input id="dmCarbs" type="number" value="${m.carbs||""}"></div>
    <div class="field"><label>Gorduras (g)</label><input id="dmFat" type="number" value="${m.fat||""}"></div>
  </div><button class="primary" onclick="mlSaveDietMacros()">Salvar</button>`);
}
async function mlSaveDietMacros(){state.diet ||= {id:uid(),meals:[],water:0,waterTarget:2};state.diet.macros={calories:Number($("#dmCalories")?.value)||0,protein:Number($("#dmProtein")?.value)||0,carbs:Number($("#dmCarbs")?.value)||0,fat:Number($("#dmFat")?.value)||0};saveLocal();if(isLogged())await api("saveDiet",{item:state.diet});closeModal();renderDiet();toast("Macros atualizados.");}

/* ---------- Peso atualiza automaticamente meta em kg ---------- */
const mlBaseAddWeight = addWeight;
addWeight = async function() {
  const raw = Number($("#wValue")?.value);
  if (!raw) return toast("Informe o peso.");
  await mlBaseAddWeight();
  mlEnsureState();
  const goal = state.goals.find(g => g.category === "Peso" || String(g.unit||"").toLowerCase() === "kg");
  if (goal) {
    goal.currentValue = raw;
    goal.updatedAt = new Date().toISOString();
    saveLocal();
    if (isLogged()) await api("saveGoal", {item: goal});
  }
};


/* =========================================================
   V6 — CALCULADORA METABÓLICA (TMB / TDEE)
   Integrada a Peso & Progresso e às metas calóricas da Dieta.
========================================================= */

function mlLatestWeightValue() {
  const items = Array.isArray(state.weight) ? [...state.weight] : [];
  if (!items.length) return 0;

  items.sort((a, b) => {
    const da = new Date(`${normalizeDate(a.date)}T12:00:00`).getTime();
    const db = new Date(`${normalizeDate(b.date)}T12:00:00`).getTime();
    return da - db;
  });

  return Number(items.at(-1)?.value || 0);
}

function mlMetabolicProfile() {
  const fromDiet = state.diet?.metabolic || {};
  const local = state.metabolic || {};

  const profile = {
    sex: local.sex || fromDiet.sex || "male",
    age: Number(local.age || fromDiet.age || 0),
    height: Number(local.height || fromDiet.height || 0),
    weight: Number(mlLatestWeightValue() || local.weight || fromDiet.weight || 0),
    activity: local.activity || fromDiet.activity || "moderate",
    objective: local.objective || fromDiet.objective || "cut",
    adjustment: Number(local.adjustment ?? fromDiet.adjustment ?? 500),
    autoSyncCalories: local.autoSyncCalories ?? fromDiet.autoSyncCalories ?? true,
    tmb: Number(local.tmb || fromDiet.tmb || 0),
    tdee: Number(local.tdee || fromDiet.tdee || 0),
    calorieTarget: Number(local.calorieTarget || fromDiet.calorieTarget || 0),
    weeklyEstimate: Number(local.weeklyEstimate || fromDiet.weeklyEstimate || 0),
    updatedAt: local.updatedAt || fromDiet.updatedAt || ""
  };

  state.metabolic = profile;
  return profile;
}

function mlActivityFactor(value) {
  return ({
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very: 1.725,
    extreme: 1.9
  })[value] || 1.55;
}

function mlCalculateMetabolicValues(profile) {
  const weight = Number(profile.weight || 0);
  const height = Number(profile.height || 0);
  const age = Number(profile.age || 0);

  if (!weight || !height || !age) return null;

  // Fórmula de Mifflin-St Jeor.
  const sexOffset = profile.sex === "female" ? -161 : 5;
  const tmb = (10 * weight) + (6.25 * height) - (5 * age) + sexOffset;
  const tdee = tmb * mlActivityFactor(profile.activity);

  const adjustment = Math.max(0, Number(profile.adjustment || 0));
  let calorieTarget = tdee;

  if (profile.objective === "cut") calorieTarget = tdee - adjustment;
  if (profile.objective === "gain") calorieTarget = tdee + adjustment;

  calorieTarget = Math.max(0, calorieTarget);

  // Aproximação energética: 7.700 kcal ≈ 1 kg de gordura corporal.
  const weeklyEstimate = profile.objective === "maintain"
    ? 0
    : (adjustment * 7) / 7700;

  return {
    tmb: Math.round(tmb),
    tdee: Math.round(tdee),
    calorieTarget: Math.round(calorieTarget),
    weeklyEstimate: Number(weeklyEstimate.toFixed(2))
  };
}

function mlMetabolicObjectiveLabel(value) {
  return ({ cut: "Perder peso", maintain: "Manter peso", gain: "Ganhar peso" })[value] || "Perder peso";
}

function mlMetabolicActivityLabel(value) {
  return ({
    sedentary: "Sedentário",
    light: "Levemente ativo",
    moderate: "Moderadamente ativo",
    very: "Muito ativo",
    extreme: "Extremamente ativo"
  })[value] || "Moderadamente ativo";
}

function mlMetabolicCardHtml() {
  const profile = mlMetabolicProfile();
  const calc = mlCalculateMetabolicValues(profile);
  const tmb = calc?.tmb || profile.tmb || 0;
  const tdee = calc?.tdee || profile.tdee || 0;
  const target = calc?.calorieTarget || profile.calorieTarget || 0;

  return `
    <div class="section-head" style="margin-top:18px">
      <div>
        <h2>Calculadora metabólica</h2>
        <div class="muted">TMB, gasto diário estimado e meta calórica.</div>
      </div>
      <button class="primary" onclick="mlMetabolicModal()">${tmb ? "Recalcular" : "Calcular"}</button>
    </div>

    <div class="grid cols-4">
      <div class="card">
        <div class="metric-label">Metabolismo basal</div>
        <div class="big">${tmb ? tmb.toLocaleString("pt-BR") : "—"} ${tmb ? "kcal" : ""}</div>
        <div class="muted">Energia estimada em repouso</div>
      </div>

      <div class="card">
        <div class="metric-label">Gasto diário</div>
        <div class="big">${tdee ? tdee.toLocaleString("pt-BR") : "—"} ${tdee ? "kcal" : ""}</div>
        <div class="muted">${mlMetabolicActivityLabel(profile.activity)}</div>
      </div>

      <div class="card">
        <div class="metric-label">Meta calórica</div>
        <div class="big">${target ? target.toLocaleString("pt-BR") : "—"} ${target ? "kcal" : ""}</div>
        <div class="muted">${mlMetabolicObjectiveLabel(profile.objective)}</div>
      </div>

      <div class="card">
        <div class="metric-label">Variação teórica</div>
        <div class="big">${calc && profile.objective !== "maintain" ? `≈ ${calc.weeklyEstimate.toFixed(2)} kg` : "—"}</div>
        <div class="muted">por semana · estimativa</div>
      </div>
    </div>
  `;
}

function mlMetabolicModal() {
  const p = mlMetabolicProfile();
  const latestWeight = mlLatestWeightValue();

  openModal("Calculadora metabólica", `
    <div class="form-grid">
      <div class="field">
        <label>Sexo</label>
        <select id="mbSex">
          <option value="male" ${p.sex === "male" ? "selected" : ""}>Masculino</option>
          <option value="female" ${p.sex === "female" ? "selected" : ""}>Feminino</option>
        </select>
      </div>

      <div class="field">
        <label>Idade</label>
        <input id="mbAge" type="number" min="14" max="100" value="${p.age || ""}" placeholder="Ex.: 29">
      </div>

      <div class="field">
        <label>Altura (cm)</label>
        <input id="mbHeight" type="number" min="120" max="230" step="1" value="${p.height || ""}" placeholder="Ex.: 176">
      </div>

      <div class="field">
        <label>Peso atual (kg)</label>
        <input id="mbWeight" type="number" min="30" max="350" step="0.1" value="${latestWeight || p.weight || ""}" placeholder="Ex.: 90">
        ${latestWeight ? `<small class="muted">Preenchido pelo último peso registrado no MetaLife.</small>` : ""}
      </div>

      <div class="field">
        <label>Nível de atividade</label>
        <select id="mbActivity">
          <option value="sedentary" ${p.activity === "sedentary" ? "selected" : ""}>Sedentário</option>
          <option value="light" ${p.activity === "light" ? "selected" : ""}>Levemente ativo</option>
          <option value="moderate" ${p.activity === "moderate" ? "selected" : ""}>Moderadamente ativo</option>
          <option value="very" ${p.activity === "very" ? "selected" : ""}>Muito ativo</option>
          <option value="extreme" ${p.activity === "extreme" ? "selected" : ""}>Extremamente ativo</option>
        </select>
      </div>

      <div class="field">
        <label>Objetivo</label>
        <select id="mbObjective" onchange="mlUpdateMetabolicAdjustmentLabel()">
          <option value="cut" ${p.objective === "cut" ? "selected" : ""}>Perder peso</option>
          <option value="maintain" ${p.objective === "maintain" ? "selected" : ""}>Manter peso</option>
          <option value="gain" ${p.objective === "gain" ? "selected" : ""}>Ganhar peso</option>
        </select>
      </div>

      <div class="field">
        <label id="mbAdjustmentLabel">${p.objective === "gain" ? "Superávit diário" : "Déficit diário"} (kcal)</label>
        <input id="mbAdjustment" type="number" min="0" max="1500" step="50" value="${p.adjustment || 500}" ${p.objective === "maintain" ? "disabled" : ""}>
      </div>
    </div>

    <label style="display:flex;align-items:center;gap:10px;margin:14px 0 18px;cursor:pointer">
      <input id="mbSyncDiet" type="checkbox" ${p.autoSyncCalories !== false ? "checked" : ""}>
      <span>Usar automaticamente a meta calórica calculada na Dieta</span>
    </label>

    <div class="card" style="margin-bottom:16px">
      <div class="muted">Os valores são estimativas. O gasto real pode variar entre pessoas e ao longo do tempo.</div>
    </div>

    <button class="primary" onclick="mlSaveMetabolicCalculation()">Calcular e salvar</button>
  `);
}

function mlUpdateMetabolicAdjustmentLabel() {
  const objective = $("#mbObjective")?.value || "cut";
  const label = $("#mbAdjustmentLabel");
  const input = $("#mbAdjustment");
  if (!label || !input) return;

  if (objective === "maintain") {
    label.textContent = "Ajuste diário (kcal)";
    input.disabled = true;
    return;
  }

  input.disabled = false;
  label.textContent = objective === "gain"
    ? "Superávit diário (kcal)"
    : "Déficit diário (kcal)";
}

async function mlSaveMetabolicCalculation() {
  const profile = {
    sex: $("#mbSex")?.value || "male",
    age: Number($("#mbAge")?.value || 0),
    height: Number($("#mbHeight")?.value || 0),
    weight: Number($("#mbWeight")?.value || 0),
    activity: $("#mbActivity")?.value || "moderate",
    objective: $("#mbObjective")?.value || "cut",
    adjustment: Number($("#mbAdjustment")?.value || 0),
    autoSyncCalories: !!$("#mbSyncDiet")?.checked,
    updatedAt: new Date().toISOString()
  };

  if (profile.age < 14 || profile.age > 100) return toast("Informe uma idade válida.");
  if (profile.height < 120 || profile.height > 230) return toast("Informe uma altura válida em centímetros.");
  if (profile.weight < 30 || profile.weight > 350) return toast("Informe um peso válido.");

  if (profile.objective === "maintain") profile.adjustment = 0;

  const calc = mlCalculateMetabolicValues(profile);
  if (!calc) return toast("Não foi possível calcular.");

  Object.assign(profile, calc);
  state.metabolic = profile;

  // Salva junto ao plano de dieta para sincronizar entre dispositivos.
  state.diet ||= {
    id: "DIET_PLAN",
    meals: [],
    water: 0,
    waterTarget: 2,
    macros: {}
  };

  state.diet.metabolic = { ...profile };
  state.diet.macros ||= {};

  if (profile.autoSyncCalories) {
    state.diet.macros.calories = calc.calorieTarget;
  }

  state.diet.updatedAt = new Date().toISOString();
  saveLocal();

  if (isLogged()) {
    const response = await api("saveDiet", { item: state.diet });
    if (!response?.ok) {
      toast(response?.error || "Cálculo salvo localmente, mas não foi possível sincronizar.");
      closeModal();
      renderWeight();
      return;
    }
  }

  closeModal();
  renderWeight();
  toast(`TMB: ${calc.tmb} kcal · Meta: ${calc.calorieTarget} kcal/dia`);
}

/* Mostra a calculadora dentro de Peso & Progresso. */
const mlBaseRenderWeightMetabolic = renderWeight;
renderWeight = function() {
  mlBaseRenderWeightMetabolic();
  const host = $("#content");
  if (!host) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = mlMetabolicCardHtml();
  host.append(...wrapper.children);
};

/* Ao registrar novo peso, recalcula automaticamente TMB/TDEE se o perfil existir. */
const mlBaseAddWeightMetabolic = addWeight;
addWeight = async function() {
  const raw = Number($("#wValue")?.value || 0);
  await mlBaseAddWeightMetabolic();

  const existing = state.metabolic || state.diet?.metabolic;
  if (!raw || !existing?.age || !existing?.height) return;

  const profile = {
    ...existing,
    weight: raw,
    updatedAt: new Date().toISOString()
  };

  const calc = mlCalculateMetabolicValues(profile);
  if (!calc) return;

  Object.assign(profile, calc);
  state.metabolic = profile;

  state.diet ||= {
    id: "DIET_PLAN",
    meals: [],
    water: 0,
    waterTarget: 2,
    macros: {}
  };

  state.diet.metabolic = { ...profile };
  state.diet.macros ||= {};

  if (profile.autoSyncCalories !== false) {
    state.diet.macros.calories = calc.calorieTarget;
  }

  state.diet.updatedAt = new Date().toISOString();
  saveLocal();

  if (isLogged()) {
    await api("saveDiet", { item: state.diet });
  }
};


/* =========================================================
   METALIFE V7 — CAMADA DE ESTABILIDADE
========================================================= */
window.METALIFE_VERSION = "7.0.0";

window.addEventListener("unhandledrejection", event => {
  console.error("MetaLife: erro assíncrono não tratado", event.reason);
});

window.addEventListener("error", event => {
  console.error("MetaLife: erro de execução", event.error || event.message);
});
