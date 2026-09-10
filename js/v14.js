/* MetaLife V14 — experiência, retenção e organização (sem Coach IA). */
(() => {
  const KEY = 'ml_v14_';
  const now = () => new Date();
  const iso = d => {
    const x = d ? new Date(d) : new Date();
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  };
  const owner = () => String(localStorage.getItem('ml_user_id') || 'demo');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr = v => Array.isArray(v) ? v : [];
  const num = v => Number(v) || 0;
  const load = (name, fallback) => { try { const v = JSON.parse(localStorage.getItem(KEY + owner() + '_' + name) || 'null'); return v ?? fallback; } catch { return fallback; } };
  const save = (name, value) => localStorage.setItem(KEY + owner() + '_' + name, JSON.stringify(value));
  const dayOf = item => String(item?.date || item?.day || item?.created_at || item?.createdAt || '').slice(0,10);
  const done = item => !!(item?.done || item?.completed || item?.status === 'done' || num(item?.value) >= num(item?.target || 1));
  const titleOf = item => item?.title || item?.name || item?.nome || item?.label || 'Item';

  const pageAliases = {
    'meu dia':'Meu Dia','metas':'Metas','treino':'Treino','dieta':'Dieta','hábitos':'Hábitos','habitos':'Hábitos',
    'peso':'Peso & Progresso','progresso':'Meu Progresso','comunidade':'Comunidade','pessoas':'Pessoas','amigos':'Pessoas',
    'desafios':'Desafios','chats':'Chats','chat':'Chats','evolução':'Evolução','evolucao':'Evolução','central':'Central V14'
  };

  function stateSafe(){ try { return state || Store.load(); } catch { return Store.load(); } }
  function monthKey(d = now()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  function monthLabel(d = now()){ return d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}); }
  function previousMonth(d = now()){ return new Date(d.getFullYear(), d.getMonth()-1, 1); }
  function weekStart(d = now()){ const x = new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
  function inRange(item,a,b){ const k=dayOf(item); return k && k>=iso(a) && k<=iso(b); }
  function uniqueDays(items){ return new Set(items.map(dayOf).filter(Boolean)).size; }

  function dashboardPrefs(){ return load('dashboard',{score:true,weight:true,goals:true,workout:true,diet:true,habits:true,tasks:true,xp:true,health:true}); }
  function focusIds(){ return load('focus_'+iso(),[]); }
  function goalMeta(){ return load('goal_meta',{}); }
  function onboarding(){ return load('onboarding',null); }

  function calcStreak(items, predicate = done){
    const dates = new Set(arr(items).filter(predicate).map(dayOf).filter(Boolean));
    let s=0,d=new Date();
    if(!dates.has(iso(d))){ d.setDate(d.getDate()-1); }
    while(dates.has(iso(d))){ s++; d.setDate(d.getDate()-1); }
    return s;
  }

  function statsForMonth(d){
    const s=stateSafe(), key=monthKey(d);
    const filter=x=>dayOf(x).startsWith(key);
    const daily=arr(s.daily).filter(filter), tasks=arr(s.tasks).filter(filter), workouts=arr(s.workouts).filter(filter), weights=arr(s.weight).filter(filter);
    const habitDone=arr(s.daily).filter(x=>filter(x) && /habit/i.test(String(x.type||x.kind||'')) && done(x)).length;
    return {
      activeDays: uniqueDays([...daily.filter(done),...tasks.filter(done),...workouts]),
      dailyDone: daily.filter(done).length,
      tasksDone: tasks.filter(done).length,
      workouts: workouts.length,
      habitDone,
      weightStart: weights[0]?.value ?? weights[0]?.weight ?? null,
      weightEnd: weights.at(-1)?.value ?? weights.at(-1)?.weight ?? null
    };
  }

  function healthScore(){
    const s=stateSafe(), start=new Date(); start.setDate(start.getDate()-6);
    const daily=arr(s.daily).filter(x=>inRange(x,start,now()));
    const tasks=arr(s.tasks).filter(x=>inRange(x,start,now()));
    const workouts=arr(s.workouts).filter(x=>inRange(x,start,now()));
    const habits=arr(s.habits);
    const parts=[];
    if(daily.length) parts.push(daily.filter(done).length/daily.length);
    if(tasks.length) parts.push(tasks.filter(done).length/tasks.length);
    parts.push(Math.min(1,workouts.length/3));
    if(habits.length){ const active=habits.filter(h=>String(h.lastDone||'').slice(0,10)>=iso(start)).length; parts.push(active/habits.length); }
    const diet=s.diet; if(diet) parts.push(Math.min(1,(num(diet.water)||0)/(num(diet.waterTarget)||2)));
    return Math.round((parts.reduce((a,b)=>a+b,0)/(parts.length||1))*100);
  }

  function achievements(){
    const s=stateSafe(); const out=[];
    const wd=arr(s.workouts).length, td=arr(s.tasks).filter(done).length, weights=arr(s.weight), streak=calcStreak(arr(s.daily));
    if(wd>=1) out.push(['🏋','Primeiro treino']); if(wd>=10) out.push(['💪','10 treinos']); if(wd>=50) out.push(['🥇','50 treinos']);
    if(td>=10) out.push(['✅','10 tarefas']); if(td>=100) out.push(['⚡','100 tarefas']);
    if(streak>=7) out.push(['🔥','7 dias de consistência']); if(streak>=30) out.push(['🏆','30 dias de consistência']);
    if(weights.length>=5) out.push(['⚖','5 registros de peso']);
    const xp=num(s.unifiedProgress?.xp ?? s.user?.xp); if(xp>=1000) out.push(['✨','1.000 XP']); if(xp>=5000) out.push(['💎','5.000 XP']);
    return out;
  }

  function weeklySummary(){
    const s=stateSafe(), start=weekStart(), end=new Date(start); end.setDate(end.getDate()+6);
    const daily=arr(s.daily).filter(x=>inRange(x,start,end)), tasks=arr(s.tasks).filter(x=>inRange(x,start,end)), workouts=arr(s.workouts).filter(x=>inRange(x,start,end)), weights=arr(s.weight).filter(x=>inRange(x,start,end));
    const adherence=daily.length?Math.round(daily.filter(done).length/daily.length*100):0;
    const delta=weights.length>1 ? num(weights.at(-1)?.value)-num(weights[0]?.value) : null;
    return {start:iso(start),end:iso(end),daily:daily.filter(done).length,totalDaily:daily.length,tasks:tasks.filter(done).length,workouts:workouts.length,adherence,weightDelta:delta};
  }

  function season(){
    const s=stateSafe(), m=statsForMonth(now()), xp=num(s.unifiedProgress?.xp ?? s.user?.xp), score=Math.round(m.activeDays*20+m.workouts*40+m.tasksDone*5+Math.min(1500,xp/10));
    const league=score>=1400?'Diamante':score>=900?'Ouro':score>=450?'Prata':'Bronze';
    const next={Bronze:450,Prata:900,Ouro:1400,Diamante:1400}[league];
    return {score,league,next};
  }

  function goalProgress(goal){
    const meta=goalMeta()[goal.id]||{}; const subs=arr(meta.subtasks);
    if(subs.length) return Math.round(subs.filter(x=>x.done).length/subs.length*100);
    const current=num(goal.current ?? goal.value ?? goal.progress), target=num(goal.target ?? goal.goal ?? 100);
    return target?Math.max(0,Math.min(100,Math.round(current/target*100))):0;
  }

  function goalProjection(goal){
    const meta=goalMeta()[goal.id]||{}; if(!meta.deadline) return 'Defina um prazo para acompanhar a projeção.';
    const pct=goalProgress(goal), today=new Date(), deadline=new Date(meta.deadline+'T12:00:00');
    const remaining=Math.ceil((deadline-today)/86400000); if(remaining<0) return pct>=100?'Meta concluída.':'Prazo encerrado.';
    if(pct>=100) return 'Meta concluída antes do prazo.';
    const need=(100-pct)/Math.max(1,remaining);
    return `Faltam ${remaining} dias · avance em média ${need.toFixed(1)}% por dia.`;
  }

  function notificationItems(){
    const s=stateSafe(), list=[], td=iso();
    const pending=arr(s.tasks).filter(x=>(!dayOf(x)||dayOf(x)===td)&&!done(x));
    if(pending.length) list.push({icon:'✓',title:`${pending.length} tarefa(s) pendente(s) hoje`,page:'Trabalho & Tarefas'});
    const ach=achievements(); if(ach.length) list.push({icon:'🏆',title:`Você já desbloqueou ${ach.length} conquista(s)`,page:'Central V14',tab:'achievements'});
    const w=weeklySummary(); if(new Date().getDay()===0) list.push({icon:'📊',title:`Resumo semanal: ${w.workouts} treinos e ${w.adherence}% de aderência`,page:'Central V14',tab:'weekly'});
    const unread=num(document.documentElement.dataset.chatUnread); if(unread) list.push({icon:'💬',title:`${unread} mensagem(ns) não lida(s)`,page:'Chats'});
    const sc=healthScore(); if(sc<50) list.push({icon:'♡',title:'Sua consistência dos últimos 7 dias está abaixo de 50%',page:'Central V14',tab:'health'});
    return list;
  }

  function personalizedDashboard(){
    const s=stateSafe(), p=dashboardPrefs(), latestWeight=arr(s.weight).at(-1), goals=arr(s.goals), today=iso(), workouts=arr(s.workouts).filter(x=>dayOf(x)===today), tasks=arr(s.tasks).filter(x=>(!dayOf(x)||dayOf(x)===today)&&!done(x));
    const cards=[];
    if(p.score) cards.push(['Score',`${healthScore()}/100`,'Consistência 7 dias']);
    if(p.weight) cards.push(['Peso',latestWeight?`${esc(latestWeight.value ?? latestWeight.weight)} kg`:'—','Último registro']);
    if(p.goals) cards.push(['Metas',`${goals.filter(g=>goalProgress(g)>=100).length}/${goals.length}`,'Concluídas']);
    if(p.workout) cards.push(['Treino',workouts.length?'Registrado':'Pendente','Hoje']);
    if(p.diet) cards.push(['Dieta',s.diet?'Plano ativo':'Sem plano','Hoje']);
    if(p.habits) cards.push(['Hábitos',String(arr(s.habits).length),'Ativos']);
    if(p.tasks) cards.push(['Tarefas',String(tasks.length),'Pendentes']);
    if(p.xp) cards.push(['XP',String(num(s.unifiedProgress?.xp ?? s.user?.xp)),'Total']);
    if(p.health) cards.push(['Saúde',`${healthScore()}%`,'Indicador comportamental']);
    return `<section class="v14-dashboard"><div class="v14-section-head"><div><div class="eyebrow">PAINEL PERSONALIZADO</div><h2>Visão rápida</h2></div><button class="chip-btn" data-v14-open="settings">Personalizar</button></div><div class="v14-card-grid">${cards.map(c=>`<article class="v14-mini"><small>${c[0]}</small><b>${c[1]}</b><span>${c[2]}</span></article>`).join('')}</div></section>`;
  }

  function injectDashboard(){
    const host=document.getElementById('content'); if(!host || document.getElementById('v14Dashboard')) return;
    const wrap=document.createElement('div'); wrap.id='v14Dashboard'; wrap.innerHTML=personalizedDashboard(); host.prepend(wrap);
  }

  function tabs(active){
    const items=[['home','Resumo'],['goals','Metas+'],['streaks','Streaks'],['achievements','Conquistas'],['weekly','Semanal'],['focus','Foco'],['backup','Backup'],['compare','Comparar'],['health','Saúde'],['season','Temporada'],['settings','Ajustes']];
    return `<nav class="v14-tabs">${items.map(([id,l])=>`<button class="chip-btn ${id===active?'selected':''}" data-v14-tab="${id}">${l}</button>`).join('')}</nav>`;
  }

  let activeTab='home';
  function render(tab=activeTab){
    activeTab=tab; const host=document.getElementById('content'); if(!host) return;
    document.getElementById('pageTitle').textContent='Central V14';
    host.innerHTML=`<section class="v14-page"><header class="v14-hero"><div><div class="eyebrow">METALIFE V14</div><h2>Central pessoal</h2><p>Organização, foco, progresso e personalização sem depender de serviços externos.</p></div><div class="v14-health-ring"><b>${healthScore()}</b><span>Saúde</span></div></header>${tabs(activeTab)}<div id="v14Panel"></div></section>`;
    paint();
  }

  function paint(){
    const p=document.getElementById('v14Panel'); if(!p) return; const s=stateSafe();
    const views={
      home(){ const n=notificationItems(), se=season(); return `${personalizedDashboard()}<div class="v14-grid"><article class="card"><h3>Central de notificações</h3>${n.length?n.slice(0,5).map((x,i)=>`<button class="v14-notice" data-v14-notice="${i}"><span>${x.icon}</span><b>${esc(x.title)}</b></button>`).join(''):'<p class="muted">Nenhum aviso importante agora.</p>'}</article><article class="card"><h3>Temporada atual</h3><div class="v14-season"><b>${se.league}</b><span>${se.score} pontos em ${esc(monthLabel())}</span></div><button class="primary" data-open="Desafios">Ver competições</button></article></div>`; },
      goals(){ const goals=arr(s.goals),meta=goalMeta(); return `<article class="card"><div class="v14-section-head"><div><h3>Metas avançadas</h3><p class="muted">Prazo, subtarefas e projeção de ritmo.</p></div></div>${goals.length?goals.map(g=>{const m=meta[g.id]||{},pct=goalProgress(g);return `<section class="v14-goal"><div class="v14-section-head"><div><b>${esc(titleOf(g))}</b><small>${pct}% concluído</small></div><button class="chip-btn" data-v14-goal="${esc(g.id)}">Configurar</button></div><div class="progress"><span style="width:${pct}%"></span></div><p class="muted">${esc(goalProjection(g))}</p>${arr(m.subtasks).map((t,i)=>`<label class="v14-sub"><input type="checkbox" data-v14-sub="${esc(g.id)}" data-index="${i}" ${t.done?'checked':''}> ${esc(t.title)}</label>`).join('')}</section>`}).join(''):'<p>Crie uma meta primeiro na área Metas.</p>'}</article>`; },
      streaks(){ const ds=calcStreak(arr(s.daily)),ws=calcStreak(arr(s.workouts),()=>true),ts=calcStreak(arr(s.tasks)); return `<div class="v14-card-grid"><article class="v14-mini"><small>Meu Dia</small><b>🔥 ${ds}</b><span>dias seguidos</span></article><article class="v14-mini"><small>Treinos</small><b>🏋 ${ws}</b><span>sequência</span></article><article class="v14-mini"><small>Tarefas</small><b>✓ ${ts}</b><span>sequência</span></article></div><article class="card"><h3>Consistência</h3><p>Melhor estratégia: manter pequenas ações registradas todos os dias. O streak usa seus registros atuais e não cria diagnóstico de saúde.</p></article>`; },
      achievements(){ const a=achievements(); return `<article class="card"><h3>Conquistas desbloqueadas</h3><div class="v14-achievements">${a.length?a.map(x=>`<div><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join(''):'<p class="muted">Continue registrando sua rotina para desbloquear conquistas.</p>'}</div></article>`; },
      weekly(){ const w=weeklySummary(); return `<div class="v14-card-grid"><article class="v14-mini"><small>Treinos</small><b>${w.workouts}</b><span>esta semana</span></article><article class="v14-mini"><small>Tarefas</small><b>${w.tasks}</b><span>concluídas</span></article><article class="v14-mini"><small>Aderência</small><b>${w.adherence}%</b><span>Meu Dia</span></article><article class="v14-mini"><small>Peso</small><b>${w.weightDelta==null?'—':`${w.weightDelta>0?'+':''}${w.weightDelta.toFixed(1)} kg`}</b><span>variação semanal</span></article></div><article class="card"><h3>${esc(w.start)} → ${esc(w.end)}</h3><p>Você concluiu ${w.daily} de ${w.totalDaily} ações registradas no Meu Dia e ${w.tasks} tarefas.</p></article>`; },
      focus(){ const today=iso(), options=[...arr(s.daily).filter(x=>dayOf(x)===today&&!done(x)),...arr(s.tasks).filter(x=>(!dayOf(x)||dayOf(x)===today)&&!done(x))], ids=focusIds(); return `<article class="card"><h3>Modo foco</h3><p class="muted">Escolha até 3 prioridades para hoje.</p><div class="v14-focus-list">${options.length?options.map(x=>`<label><input type="checkbox" data-v14-focus="${esc(x.id)}" ${ids.includes(String(x.id))?'checked':''}> ${esc(titleOf(x))}</label>`).join(''):'<p>Nenhuma pendência encontrada para hoje.</p>'}</div><button class="primary" data-v14-focus-view>Ver somente prioridades</button></article>`; },
      backup(){ return `<article class="card"><h3>Backup e exportação</h3><p>Baixe uma cópia dos seus dados deste navegador.</p><div class="row"><button class="primary" data-v14-export="json">Exportar JSON</button><button class="chip-btn" data-v14-export="csv">Resumo CSV</button></div><p class="muted">O arquivo é gerado no seu aparelho. Não envia seus dados para outro serviço.</p></article>`; },
      compare(){ const cur=statsForMonth(now()), prevD=previousMonth(),prev=statsForMonth(prevD); return `<article class="card"><h3>Comparação mensal</h3><div class="v14-compare"><div><b>${esc(monthLabel(prevD))}</b><span>${prev.activeDays} dias ativos</span><span>${prev.workouts} treinos</span><span>${prev.tasksDone} tarefas</span></div><div><b>${esc(monthLabel())}</b><span>${cur.activeDays} dias ativos</span><span>${cur.workouts} treinos</span><span>${cur.tasksDone} tarefas</span></div></div></article>`; },
      health(){ const sc=healthScore(); return `<article class="card"><h3>Indicador geral de consistência</h3><div class="v14-big-score">${sc}<small>/100</small></div><p>Combina registros de rotina, tarefas, treinos, hábitos e hidratação quando disponíveis. É um indicador comportamental do MetaLife, não uma avaliação médica.</p></article>`; },
      season(){ const se=season(); return `<article class="card"><h3>Temporada ${esc(monthLabel())}</h3><div class="v14-league ${se.league.toLowerCase()}"><span>🏅</span><b>Liga ${se.league}</b><strong>${se.score} pts</strong></div><p class="muted">Pontos locais da temporada consideram dias ativos, treinos, tarefas e XP. Para competir com amigos, use as Competições existentes.</p><button class="primary" data-open="Desafios">Abrir competições e ranking</button></article>`; },
      settings(){ const prefs=dashboardPrefs(); return `<div class="v14-grid"><article class="card"><h3>Painel inicial</h3><div class="v14-checks">${Object.entries({score:'Score',weight:'Peso',goals:'Metas',workout:'Treino',diet:'Dieta',habits:'Hábitos',tasks:'Tarefas',xp:'XP',health:'Saúde'}).map(([k,l])=>`<label><input type="checkbox" data-v14-pref="${k}" ${prefs[k]!==false?'checked':''}> ${l}</label>`).join('')}</div></article><article class="card"><h3>Tema</h3><div class="row"><button class="chip-btn" data-v14-theme="light">Claro</button><button class="chip-btn" data-v14-theme="dark">Escuro</button><button class="chip-btn" data-v14-theme="auto">Automático</button></div><hr><button class="chip-btn" data-v14-onboarding>Refazer configuração inicial</button></article></div>`; }
    };
    p.innerHTML=(views[activeTab]||views.home)();
  }

  function topTools(){
    const top=document.querySelector('.top-actions'); if(!top||document.getElementById('v14Tools')) return;
    const box=document.createElement('div'); box.id='v14Tools'; box.className='v14-tools';
    box.innerHTML='<button class="icon-btn" data-v14-search aria-label="Buscar" title="Buscar">⌕</button><button class="icon-btn v14-bell" data-v14-bell aria-label="Notificações" title="Notificações">♢<span></span></button>';
    top.prepend(box); updateBell();
  }

  function updateBell(){ const b=document.querySelector('.v14-bell span'); if(b) b.textContent=notificationItems().length||''; }

  function ensureCentralNav(){
    const groups=document.getElementById('navGroups'); if(!groups||groups.querySelector('[data-v14-central]')) return;
    const sec=document.createElement('section'); sec.className='nav-group'; sec.innerHTML='<h2 class="nav-group-label">Ferramentas</h2><button type="button" class="nav-button" data-v14-central><span aria-hidden="true">◈</span>Central V14</button>';
    sec.querySelector('button').onclick=()=>openCentral('home');
    groups.insertBefore(sec,groups.querySelector('.nav-mobile-account')||null);
  }

  function openCentral(tab='home'){
    document.querySelector('.nav-more[aria-expanded="true"]')?.click();
    activeTab=tab; render(tab); window.scrollTo({top:0,behavior:'smooth'});
  }

  function searchModal(){
    openModal('Busca global',`<div class="v14-search"><input id="v14SearchInput" autofocus placeholder="Ex.: treino, meta, peso, João"><div id="v14SearchResults"></div></div>`);
    const input=document.getElementById('v14SearchInput'); input?.focus(); input?.addEventListener('input',()=>doSearch(input.value));
  }

  function doSearch(q){
    const out=document.getElementById('v14SearchResults'); if(!out) return; const term=q.trim().toLowerCase(); if(!term){out.innerHTML='<p class="muted">Digite para pesquisar páginas e registros.</p>';return;}
    const s=stateSafe(), hits=[];
    Object.entries(pageAliases).forEach(([k,page])=>{ if(k.includes(term)) hits.push({kind:'Página',title:page,page}); });
    const sets=[['Meta',s.goals,'Metas'],['Tarefa',s.tasks,'Trabalho & Tarefas'],['Treino',s.workouts,'Treino'],['Pessoa',s.friends,'Pessoas']];
    sets.forEach(([kind,items,page])=>arr(items).forEach(x=>{if(JSON.stringify(x).toLowerCase().includes(term))hits.push({kind,title:titleOf(x),page});}));
    out.innerHTML=hits.slice(0,20).map((h,i)=>`<button class="v14-search-result" data-v14-search-hit="${i}"><small>${esc(h.kind)}</small><b>${esc(h.title)}</b></button>`).join('')||'<p>Nenhum resultado.</p>'; out._hits=hits;
  }

  function notificationsModal(){
    const list=notificationItems(); openModal('Notificações',`<div class="v14-notification-list">${list.length?list.map((x,i)=>`<button class="v14-notice" data-v14-notice="${i}"><span>${x.icon}</span><b>${esc(x.title)}</b></button>`).join(''):'<p class="muted">Você está em dia.</p>'}</div>`);
  }

  function configureGoal(id){
    const g=arr(stateSafe().goals).find(x=>String(x.id)===String(id)); if(!g)return; const meta=goalMeta(),m=meta[id]||{};
    openModal('Configurar meta',`<form id="v14GoalForm" data-id="${esc(id)}"><label>Prazo<input name="deadline" type="date" value="${esc(m.deadline||'')}"></label><label>Subtarefas (uma por linha)<textarea name="subtasks" rows="6">${esc(arr(m.subtasks).map(x=>x.title).join('\n'))}</textarea></label><button class="primary">Salvar configuração</button></form>`);
  }

  function exportData(kind){
    const s=stateSafe(), stamp=iso(); let blob,name;
    if(kind==='json'){ blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),user:owner(),state:s,v14:{dashboard:dashboardPrefs(),goalMeta:goalMeta(),onboarding:onboarding()}},null,2)],{type:'application/json'}); name=`metalife-backup-${stamp}.json`; }
    else { const cur=statsForMonth(now()); const rows=[['campo','valor'],['mes',monthLabel()],['dias_ativos',cur.activeDays],['treinos',cur.workouts],['tarefas_concluidas',cur.tasksDone],['health_score',healthScore()],['xp',num(s.unifiedProgress?.xp??s.user?.xp)]]; blob=new Blob([rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}); name=`metalife-resumo-${stamp}.csv`; }
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }

  function applyTheme(mode=load('theme','auto')){ save('theme',mode); const dark=mode==='dark'||(mode==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme=dark?'dark':'light'; document.documentElement.dataset.themeMode=mode; }

  function onboardingModal(force=false){
    if(!force && onboarding()) return;
    openModal('Configure seu MetaLife',`<form id="v14Onboarding"><p class="muted">Isso leva menos de um minuto e personaliza sua experiência.</p><label>Objetivo principal<select name="goal"><option value="saude">Saúde e rotina</option><option value="peso">Peso</option><option value="treino">Treino</option><option value="produtividade">Produtividade</option><option value="equilibrio">Equilíbrio geral</option></select></label><label>Peso atual (opcional)<input name="weight" type="number" step="0.1" min="20" max="400"></label><label>Quantos treinos por semana?<input name="workouts" type="number" min="0" max="14" value="3"></label><label>Hábito principal que quer melhorar<input name="habit" maxlength="80" placeholder="Ex.: beber água"></label><button class="primary">Começar</button></form>`);
  }

  function focusView(){ const ids=focusIds(),s=stateSafe(),all=[...arr(s.daily),...arr(s.tasks)],items=all.filter(x=>ids.includes(String(x.id))); openModal('Prioridades de hoje',items.length?`<div class="v14-focus-only">${items.map(x=>`<div><span>◎</span><b>${esc(titleOf(x))}</b></div>`).join('')}</div>`:'<p>Escolha suas prioridades primeiro.</p>'); }

  function installHooks(){
    topTools(); ensureCentralNav(); applyTheme();
    const obs=new MutationObserver(()=>{topTools();ensureCentralNav(); if(document.getElementById('pageTitle')?.textContent==='Meu Dia') injectDashboard(); updateBell();});
    obs.observe(document.body,{subtree:true,childList:true});
    setTimeout(()=>{if(localStorage.ml_token)onboardingModal(false);},1200);
  }

  document.addEventListener('submit',e=>{
    if(e.target.id==='v14GoalForm'){e.preventDefault();const id=e.target.dataset.id,fd=new FormData(e.target),meta=goalMeta(),old=meta[id]||{},titles=String(fd.get('subtasks')||'').split('\n').map(x=>x.trim()).filter(Boolean);meta[id]={...old,deadline:String(fd.get('deadline')||''),subtasks:titles.map(t=>old.subtasks?.find(x=>x.title===t)||{title:t,done:false})};save('goal_meta',meta);closeModal();openCentral('goals');toast('Meta atualizada.');}
    if(e.target.id==='v14Onboarding'){e.preventDefault();const data=Object.fromEntries(new FormData(e.target));save('onboarding',{...data,completedAt:new Date().toISOString()});closeModal();toast('MetaLife personalizado.');}
  });

  document.addEventListener('change',e=>{
    if(e.target.matches('[data-v14-pref]')){const p=dashboardPrefs();p[e.target.dataset.v14Pref]=e.target.checked;save('dashboard',p);paint();}
    if(e.target.matches('[data-v14-sub]')){const meta=goalMeta(),id=e.target.dataset.v14Sub,i=num(e.target.dataset.index);if(meta[id]?.subtasks?.[i]){meta[id].subtasks[i].done=e.target.checked;save('goal_meta',meta);paint();}}
    if(e.target.matches('[data-v14-focus]')){let ids=focusIds(),id=String(e.target.dataset.v14Focus);if(e.target.checked){if(ids.length>=3){e.target.checked=false;toast('Escolha no máximo 3 prioridades.');return;}ids=[...ids,id];}else ids=ids.filter(x=>x!==id);save('focus_'+iso(),ids);}
  });

  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-v14-tab]'); if(tab){render(tab.dataset.v14Tab);return;}
    const open=e.target.closest('[data-v14-open]'); if(open){openCentral(open.dataset.v14Open);return;}
    if(e.target.closest('[data-v14-search]')){searchModal();return;}
    if(e.target.closest('[data-v14-bell]')){notificationsModal();return;}
    const g=e.target.closest('[data-v14-goal]'); if(g){configureGoal(g.dataset.v14Goal);return;}
    const theme=e.target.closest('[data-v14-theme]'); if(theme){applyTheme(theme.dataset.v14Theme);toast('Tema atualizado.');return;}
    if(e.target.closest('[data-v14-onboarding]')){onboardingModal(true);return;}
    const exp=e.target.closest('[data-v14-export]'); if(exp){exportData(exp.dataset.v14Export);return;}
    if(e.target.closest('[data-v14-focus-view]')){focusView();return;}
    const hit=e.target.closest('[data-v14-search-hit]'); if(hit){const out=document.getElementById('v14SearchResults'),h=out?._hits?.[num(hit.dataset.v14SearchHit)];if(h){closeModal();h.page==='Central V14'?openCentral('home'):window.show?.(h.page);}return;}
    const notice=e.target.closest('[data-v14-notice]'); if(notice){const n=notificationItems()[num(notice.dataset.v14Notice)];if(n){closeModal();n.page==='Central V14'?openCentral(n.tab||'home'):window.show?.(n.page);}return;}
  });

  document.addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchModal();} });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(load('theme','auto')==='auto')applyTheme('auto');});

  window.MetaLifeV14={render:openCentral,healthScore,weeklySummary,achievements,openSearch:searchModal};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installHooks,{once:true});else installHooks();
})();
