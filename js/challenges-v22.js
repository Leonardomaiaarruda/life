/* MetaLife V22 — Desafios 2.0
   Progresso automático a partir do histórico local + integração com Competições sociais existentes. */
(() => {
  'use strict';

  const legacyRender = window.renderChallenges;
  const owner = () => String(localStorage.getItem('ml_user_id') || 'demo');
  const key = name => `ml_v22_${encodeURIComponent(owner())}_${name}`;
  const arr = v => Array.isArray(v) ? v : [];
  const num = v => Number(v) || 0;
  const read = (name, fallback) => { try { return JSON.parse(localStorage.getItem(key(name)) || 'null') ?? fallback; } catch { return fallback; } };
  const write = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = p => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
  const today = () => iso(new Date());
  const dateOf = x => String(x?.date || x?.day || x?.createdAt || x?.created_at || x?.endedAt || '').slice(0,10);
  const done = x => !!(x?.done || x?.completed || x?.status === 'done' || (num(x?.target) > 0 && num(x?.value) >= num(x?.target)));
  const stateSafe = () => { try { return state; } catch { return Store.load(); } };
  const daysBetween = (a,b) => Math.max(1, Math.floor((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`))/86400000) + 1);
  const fmt = d => d ? new Date(`${String(d).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '—';

  const METRICS = {
    workouts:{label:'Treinos concluídos',unit:'treinos',icon:'🏋'},
    active_days:{label:'Dias ativos',unit:'dias',icon:'🔥'},
    streak:{label:'Sequência de dias',unit:'dias',icon:'⚡'},
    tasks:{label:'Tarefas concluídas',unit:'tarefas',icon:'✓'},
    cardio:{label:'Cardio acumulado',unit:'min',icon:'🏃'},
    nutrition:{label:'Dias com alimentação registrada',unit:'dias',icon:'🥗'},
    training_minutes:{label:'Tempo de treino',unit:'min',icon:'⏱'},
    training_volume:{label:'Volume de treino',unit:'kg',icon:'💪'},
    weight_change_pct:{label:'Evolução de peso',unit:'%',icon:'⚖'},
    points:{label:'Pontos de consistência',unit:'pts',icon:'◆'}
  };
  const TYPES = {
    total:'Quantidade total', streak:'Sequência', improvement:'Melhor evolução percentual', first:'Primeiro a atingir', points:'Pontuação'
  };
  const SCOPES = {
    solo:'Individual', duel:'1 contra 1', group:'Grupo privado', community:'Comunidade', teams:'Equipes', cooperative:'Cooperativo'
  };
  const DIFFICULTY = {
    iniciante:{label:'Iniciante',xp:60,coins:20}, intermediario:{label:'Intermediário',xp:100,coins:35}, avancado:{label:'Avançado',xp:160,coins:55}
  };

  let tab = 'overview';
  let selected = '';

  function v15(name,fallback){ try{return JSON.parse(localStorage.getItem(`ml_v15_${encodeURIComponent(owner())}_${name}`)||'null')??fallback;}catch{return fallback;} }
  function workouts(){
    const s=stateSafe(), map=new Map();
    [...arr(s.workouts),...arr(v15('sessions',[]))].forEach((w,i)=>{
      const id=String(w.id||`${dateOf(w)}|${w.name||w.title||'treino'}|${i}`); if(!map.has(id))map.set(id,w);
    });
    return [...map.values()];
  }
  function inRange(x,start,end){ const d=dateOf(x); return d && d>=start && d<=end; }
  function nutritionDays(start,end){
    const n=v15('nutrition',{}); return Object.keys(n).filter(d=>d>=start&&d<=end&&arr(n[d]?.meals).some(m=>arr(m.items).length)).length;
  }
  function workoutVolume(w){ return arr(w.exercises).reduce((sum,e)=>sum+arr(e.sets).reduce((a,set)=>a+((set.done===false)?0:num(set.kg)*num(set.reps)),0),0); }
  function activeDates(start,end){
    const s=stateSafe(), set=new Set();
    workouts().filter(x=>inRange(x,start,end)).forEach(x=>set.add(dateOf(x)));
    arr(s.tasks).filter(x=>inRange(x,start,end)&&done(x)).forEach(x=>set.add(dateOf(x)));
    arr(s.daily).filter(x=>inRange(x,start,end)&&done(x)).forEach(x=>set.add(dateOf(x)));
    Object.keys(v15('nutrition',{})).filter(d=>d>=start&&d<=end).forEach(d=>{if(arr(v15('nutrition',{})[d]?.meals).some(m=>arr(m.items).length))set.add(d);});
    return [...set].sort();
  }
  function streak(start,end){
    const dates=new Set(activeDates(start,end)); let best=0,current=0,d=new Date(`${start}T12:00:00`),last=new Date(`${end}T12:00:00`);
    while(d<=last){ if(dates.has(iso(d))) { current++;best=Math.max(best,current); } else current=0; d.setDate(d.getDate()+1); }
    return best;
  }
  function weightChange(start,end,direction='decrease'){
    const rows=arr(stateSafe().weight).filter(x=>inRange(x,start,end)).sort((a,b)=>dateOf(a).localeCompare(dateOf(b)));
    if(rows.length<2)return 0; const a=num(rows[0].value??rows[0].weight), b=num(rows.at(-1).value??rows.at(-1).weight); if(!a)return 0;
    const raw=(b-a)/a*100; return Math.max(0,direction==='decrease'?-raw:raw);
  }
  function metricValue(metric,start,end,direction='decrease'){
    const s=stateSafe(), ws=workouts().filter(x=>inRange(x,start,end));
    if(metric==='workouts')return ws.length;
    if(metric==='active_days')return activeDates(start,end).length;
    if(metric==='streak')return streak(start,end);
    if(metric==='tasks')return arr(s.tasks).filter(x=>inRange(x,start,end)&&done(x)).length;
    if(metric==='cardio')return arr(s.daily).filter(x=>inRange(x,start,end)&&String(x.category).toLowerCase()==='cardio').reduce((a,x)=>a+num(x.value),0);
    if(metric==='nutrition')return nutritionDays(start,end);
    if(metric==='training_minutes')return ws.reduce((a,w)=>a+num(w.minutes||num(w.duration)/60),0);
    if(metric==='training_volume')return Math.round(ws.reduce((a,w)=>a+workoutVolume(w),0));
    if(metric==='weight_change_pct')return weightChange(start,end,direction);
    if(metric==='points')return ws.length*10+activeDates(start,end).length*3+arr(s.tasks).filter(x=>inRange(x,start,end)&&done(x)).length*2+arr(s.daily).filter(x=>inRange(x,start,end)&&done(x)).length*2;
    return 0;
  }

  function challenges(){ return read('challenges',[]); }
  function saveChallenges(list){ write('challenges',list); }
  function rewards(){ return read('rewards',[]); }
  function rewardConfig(c){ return DIFFICULTY[c.difficulty]||DIFFICULTY.iniciante; }
  function challengeProgress(c){
    const end=today()<c.end?today():c.end;
    let value=metricValue(c.metric,c.start,end,c.direction);
    if(c.type==='improvement'){
      const span=daysBetween(c.start,c.end),prevEnd=new Date(`${c.start}T12:00:00`);prevEnd.setDate(prevEnd.getDate()-1);const prevStart=new Date(prevEnd);prevStart.setDate(prevStart.getDate()-span+1);
      const baseline=c.baseline??metricValue(c.metric,iso(prevStart),iso(prevEnd),c.direction); value=baseline>0?Math.max(0,(value-baseline)/baseline*100):(value>0?100:0);
    }
    const target=Math.max(.01,num(c.target)||1); return {value,target,pct:Math.max(0,Math.min(100,Math.round(value/target*100)))};
  }
  function status(c){ const p=challengeProgress(c); if(p.pct>=100)return'completed'; if(today()<c.start)return'upcoming'; if(today()>c.end)return'ended'; return'active'; }

  function weekStart(d=new Date()){const x=new Date(d),n=(x.getDay()+6)%7;x.setDate(x.getDate()-n);x.setHours(12,0,0,0);return x;}
  function weekEnd(d=new Date()){const x=weekStart(d);x.setDate(x.getDate()+6);return x;}
  function ensureWeekly(){
    const start=iso(weekStart()),end=iso(weekEnd()),stamp=`auto-${start}`;const list=challenges();if(list.some(x=>x.autoStamp===stamp))return;
    list.push({id:uid('CH'),title:'Semana consistente',metric:'active_days',type:'total',scope:'solo',difficulty:'iniciante',start,end,target:5,recurrence:'none',privacy:'progress',auto:true,autoStamp:stamp,createdAt:new Date().toISOString(),description:'Fique ativo em pelo menos 5 dias desta semana. Treino, tarefas, hábitos e alimentação registrada contam como atividade.'});
    saveChallenges(list);
  }
  function rollRecurring(){
    const list=challenges();let changed=false;const existing=new Set(list.map(x=>x.parentCycle||''));
    list.slice().forEach(c=>{if(!c.recurrence||c.recurrence==='none'||today()<=c.end)return;const cycle=`${c.id}:${c.end}`;if(existing.has(cycle))return;const a=new Date(`${c.start}T12:00:00`),b=new Date(`${c.end}T12:00:00`);if(c.recurrence==='weekly'){a.setDate(a.getDate()+7);b.setDate(b.getDate()+7);}else{a.setMonth(a.getMonth()+1);b.setMonth(b.getMonth()+1);}list.push({...c,id:uid('CH'),start:iso(a),end:iso(b),rewardedAt:null,createdAt:new Date().toISOString(),parentCycle:cycle});existing.add(cycle);changed=true;});if(changed)saveChallenges(list);
  }
  function settleRewards(){
    const list=challenges(),ledger=rewards();let changed=false;
    list.forEach(c=>{if(status(c)!=='completed'||ledger.some(r=>r.challengeId===c.id))return;const rw=rewardConfig(c),reward={id:uid('RW'),challengeId:c.id,title:c.title,at:new Date().toISOString(),xp:rw.xp,coins:rw.coins,badge:c.difficulty==='avancado'?'Diamante do desafio':c.difficulty==='intermediario'?'Medalha de consistência':'Primeiro passo'};ledger.push(reward);changed=true;
      try{const k=`ml_v18_${encodeURIComponent(owner())}_coin_ledger`,coins=JSON.parse(localStorage.getItem(k)||'[]');coins.push({id:uid('coin'),type:'bonus',amount:rw.coins,note:`Desafio concluído: ${c.title}`,at:reward.at});localStorage.setItem(k,JSON.stringify(coins));}catch{}
    });if(changed)write('rewards',ledger);
  }

  function seasonData(month=new Date().toISOString().slice(0,7)){
    const rs=rewards().filter(r=>String(r.at).startsWith(month)),points=rs.reduce((a,r)=>a+num(r.xp),0);let league='Bronze',next=200;if(points>=1400){league='Diamante';next=null}else if(points>=900){league='Platina';next=1400}else if(points>=500){league='Ouro';next=900}else if(points>=200){league='Prata';next=500}return{month,points,league,next,completed:rs.length};
  }
  function achievements(){const rs=rewards(),n=rs.length,out=[];if(n>=1)out.push(['🏅','Primeiro desafio','Conclua seu primeiro desafio']);if(n>=5)out.push(['🥈','5 desafios','Cinco metas cumpridas']);if(n>=10)out.push(['🏆','Veterano','Dez desafios concluídos']);if(rs.some(r=>r.xp>=160))out.push(['💎','Desafio avançado','Concluiu um desafio avançado']);const months=[...new Set(rs.map(r=>String(r.at).slice(0,7)))];if(months.length>=3)out.push(['🔥','3 temporadas','Pontuou em três meses diferentes']);return out;}

  function recommended(){
    const s=stateSafe(),last30=new Date();last30.setDate(last30.getDate()-29);const start=iso(last30),end=today(),w=metricValue('workouts',start,end),cardio=metricValue('cardio',start,end),tasks=metricValue('tasks',start,end);return [
      {title:'3 treinos na semana',metric:'workouts',target:3,difficulty:w>=12?'intermediario':'iniciante',description:'Consistência simples para manter a semana em movimento.'},
      {title:'90 minutos de cardio',metric:'cardio',target:90,difficulty:cardio>=300?'intermediario':'iniciante',description:'Some seus minutos registrados no Meu Dia.'},
      {title:'Semana produtiva',metric:'tasks',target:10,difficulty:tasks>=40?'intermediario':'iniciante',description:'Conclua 10 tarefas durante a semana.'},
      {title:'7 dias de sequência',metric:'streak',target:7,type:'streak',difficulty:'avancado',description:'Mantenha alguma atividade registrada todos os dias.'},
      {title:'Melhorar volume de treino',metric:'training_volume',target:5,type:'improvement',difficulty:'avancado',description:'Supere em 5% o volume do período anterior equivalente.'}
    ];
  }

  function formatValue(c,p){const m=METRICS[c.metric]||{unit:''};const v=c.metric==='training_volume'?Math.round(p.value).toLocaleString('pt-BR'):Number(p.value).toLocaleString('pt-BR',{maximumFractionDigits:1});return`${v} ${m.unit}`.trim();}
  function scopeLabel(c){return SCOPES[c.scope]||'Individual';}
  function statusLabel(c){return{active:'Em andamento',completed:'Concluído',upcoming:'Em breve',ended:'Encerrado'}[status(c)];}
  function card(c){const p=challengeProgress(c),m=METRICS[c.metric]||METRICS.points,rw=rewardConfig(c);return`<article class="v22-challenge-card ${status(c)}"><div class="v22-card-top"><span class="v22-metric-icon">${m.icon}</span><div><span class="pill">${esc(statusLabel(c))}</span> <span class="v22-scope">${esc(scopeLabel(c))}</span><h3>${esc(c.title)}</h3></div><b class="v22-percent">${p.pct}%</b></div><p>${esc(c.description||m.label)}</p><div class="v22-progress"><span style="width:${p.pct}%"></span></div><div class="v22-card-meta"><span><b>${esc(formatValue(c,p))}</b> de ${Number(p.target).toLocaleString('pt-BR')} ${esc(c.type==='improvement'?'%':m.unit)}</span><span>${fmt(c.start)} → ${fmt(c.end)}</span></div><div class="v22-reward-mini">+${rw.xp} XP de desafio · +${rw.coins} MetaCoins</div><div class="v22-card-actions"><button class="primary" data-v22-open="${esc(c.id)}">Abrir</button>${c.scope!=='solo'?'<button class="chip-btn" data-v22-social>Ranking ao vivo</button>':''}</div></article>`;}

  function header(){const season=seasonData(),rs=rewards();return`<header class="v22-hero"><div><div class="eyebrow">DESAFIOS 2.0</div><h2>Transforme consistência em conquista</h2><p>O progresso é calculado automaticamente usando os registros do próprio MetaLife.</p><div class="v22-hero-actions"><button class="primary" data-v22-new>＋ Criar desafio</button><button class="secondary" data-v22-social>👥 Competir com amigos</button><button class="chip-btn" data-v22-import>Importar código</button></div></div><div class="v22-season-badge"><small>Temporada atual</small><b>${esc(season.league)}</b><span>${season.points} pts · ${rs.length} conquista(s)</span></div></header>`;}
  function tabs(){return`<nav class="v22-tabs">${[['overview','Visão geral'],['mine','Meus desafios'],['discover','Descobrir'],['seasons','Temporadas'],['achievements','Conquistas']].map(([id,l])=>`<button class="chip-btn ${tab===id?'selected':''}" data-v22-tab="${id}">${l}</button>`).join('')}</nav>`;}

  function overview(){const list=challenges(),active=list.filter(c=>['active','upcoming'].includes(status(c))).slice(0,4),season=seasonData(),next=season.next?Math.max(0,season.next-season.points):0;return`<section class="v22-kpis"><div><small>Ativos</small><b>${list.filter(c=>status(c)==='active').length}</b><span>desafios agora</span></div><div><small>Concluídos</small><b>${rewards().length}</b><span>no histórico</span></div><div><small>Liga</small><b>${season.league}</b><span>${season.next?`${next} pts para a próxima`:'nível máximo'}</span></div><div><small>MetaCoins</small><b>${rewards().reduce((a,r)=>a+num(r.coins),0)}</b><span>ganhas em desafios</span></div></section><section class="v22-section-head"><div><h3>Em andamento</h3><p>Ações registradas em treino, tarefas, cardio e alimentação atualizam o progresso sozinhas.</p></div><button class="chip-btn" data-v22-tab="mine">Ver todos</button></section><div class="v22-grid">${active.length?active.map(card).join(''):'<div class="v22-empty">Nenhum desafio ativo. Escolha uma recomendação e comece agora.</div>'}</div><section class="v22-social-callout"><div><span>🏆</span><div><h3>Ranking com amigos</h3><p>1 contra 1, grupos e equipes usam as Competições do MetaLife, com ranking, feed, fotos, reações e chat.</p></div></div><button class="primary" data-v22-social>Abrir competições</button></section>`;}
  function mine(){const list=challenges().slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));return`<section class="v22-section-head"><div><h3>Meus desafios</h3><p>Individuais, recorrentes e modelos para competições.</p></div><button class="primary" data-v22-new>＋ Novo</button></section><div class="v22-grid">${list.length?list.map(card).join(''):'<div class="v22-empty">Você ainda não criou nenhum desafio.</div>'}</div>${arr(stateSafe().challenges).length?'<div class="v22-legacy"><b>Desafios anteriores encontrados</b><span>Os desafios criados nas versões anteriores continuam disponíveis.</span><button class="chip-btn" data-v22-classic>Abrir versão clássica</button></div>':''}`;}
  function discover(){return`<section class="v22-section-head"><div><h3>Recomendados para você</h3><p>Os níveis são ajustados usando seu histórico recente.</p></div></section><div class="v22-discover-grid">${recommended().map((r,i)=>`<article class="card"><div class="v22-rec-icon">${METRICS[r.metric].icon}</div><span class="pill">${DIFFICULTY[r.difficulty].label}</span><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p><small>${TYPES[r.type||'total']} · ${r.target} ${r.type==='improvement'?'%':METRICS[r.metric].unit}</small><button class="primary" data-v22-join="${i}">Participar</button></article>`).join('')}</div>`;}
  function seasons(){const months=[];for(let i=0;i<8;i++){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);months.push(seasonData(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`));}return`<div class="v22-season-grid">${months.map(s=>`<article class="card"><span class="v22-league-dot ${s.league.toLowerCase()}"></span><small>${new Date(`${s.month}-01T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</small><h3>${s.league}</h3><b>${s.points} pontos</b><span>${s.completed} desafio(s) concluído(s)</span></article>`).join('')}</div><article class="card v22-rules"><h3>Como funcionam as ligas</h3><p>Bronze 0–199 · Prata 200–499 · Ouro 500–899 · Platina 900–1399 · Diamante 1400+ pontos por temporada.</p></article>`;}
  function achievementsView(){const a=achievements();return`<div class="v22-achievements">${[['🎯','Participante','Crie ou participe de desafios'],...a].map(([icon,title,desc])=>`<article class="card"><span>${icon}</span><div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div></article>`).join('')}</div>`;}

  function render(){ensureWeekly();rollRecurring();settleRewards();selected='';const host=document.getElementById('content');if(!host)return;document.getElementById('pageTitle').textContent='Desafios';host.innerHTML=`<section class="v22-page">${header()}${tabs()}<div id="v22Panel"></div></section>`;paint();}
  function paint(){const p=document.getElementById('v22Panel');if(!p)return;p.innerHTML=tab==='mine'?mine():tab==='discover'?discover():tab==='seasons'?seasons():tab==='achievements'?achievementsView():overview();}

  function formModal(c=null){
    const start=c?.start||today(),d=new Date(`${start}T12:00:00`);d.setDate(d.getDate()+6);const end=c?.end||iso(d);
    openModal(c?'Editar desafio':'Novo desafio',`<form id="v22ChallengeForm" data-id="${esc(c?.id||'')}"><div class="field"><label>Nome</label><input name="title" required maxlength="80" value="${esc(c?.title||'')}" placeholder="Ex.: 12 treinos em 30 dias"></div><div class="form-grid"><label>Métrica<select name="metric">${Object.entries(METRICS).map(([k,m])=>`<option value="${k}" ${c?.metric===k?'selected':''}>${m.label}</option>`).join('')}</select></label><label>Tipo<select name="type">${Object.entries(TYPES).map(([k,l])=>`<option value="${k}" ${c?.type===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Meta<input name="target" type="number" step="0.1" min="0.1" required value="${c?.target||5}"></label><label>Dificuldade<select name="difficulty">${Object.entries(DIFFICULTY).map(([k,v])=>`<option value="${k}" ${c?.difficulty===k?'selected':''}>${v.label}</option>`).join('')}</select></label><label>Formato<select name="scope">${Object.entries(SCOPES).map(([k,l])=>`<option value="${k}" ${c?.scope===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Recorrência<select name="recurrence"><option value="none">Não repetir</option><option value="weekly" ${c?.recurrence==='weekly'?'selected':''}>Semanal</option><option value="monthly" ${c?.recurrence==='monthly'?'selected':''}>Mensal</option></select></label><label>Início<input name="start" type="date" value="${start}" required></label><label>Fim<input name="end" type="date" value="${end}" required></label><label>Privacidade<select name="privacy"><option value="progress">Mostrar apenas progresso</option><option value="value" ${c?.privacy==='value'?'selected':''}>Mostrar valor da métrica</option></select></label><label>Meta de peso<select name="direction"><option value="decrease">Reduzir</option><option value="increase" ${c?.direction==='increase'?'selected':''}>Aumentar</option></select></label></div><label>Descrição<textarea name="description" rows="3" placeholder="Regras ou motivação do desafio">${esc(c?.description||'')}</textarea></label><p class="muted">Marcos de 25%, 50%, 75% e 100% são criados automaticamente. Em formatos com outras pessoas, use “Ranking ao vivo” para configurar participantes no servidor.</p><button class="primary">${c?'Salvar alterações':'Criar desafio'}</button></form>`);
  }
  function submit(form){const x=Object.fromEntries(new FormData(form)),list=challenges();x.target=num(x.target);if(!x.title.trim()||!x.start||!x.end||x.start>x.end){toast('Confira nome e período do desafio.');return;}const old=list.find(c=>c.id===form.dataset.id);const item={...(old||{}),...x,id:old?.id||uid('CH'),createdAt:old?.createdAt||new Date().toISOString(),milestones:[25,50,75,100]};if(x.type==='improvement'&&!old){const span=daysBetween(x.start,x.end),e=new Date(`${x.start}T12:00:00`);e.setDate(e.getDate()-1);const a=new Date(e);a.setDate(a.getDate()-span+1);item.baseline=metricValue(x.metric,iso(a),iso(e),x.direction);}if(old)Object.assign(old,item);else list.push(item);saveChallenges(list);closeModal();tab='mine';render();toast(old?'Desafio atualizado.':'Desafio criado.');if(item.scope!=='solo')toast('Use Ranking ao vivo para convidar pessoas e competir no servidor.');}
  function joinRecommendation(i){const r=recommended()[i];if(!r)return;const a=weekStart(),b=weekEnd(),list=challenges();const item={id:uid('CH'),title:r.title,metric:r.metric,target:r.target,type:r.type||'total',scope:'solo',difficulty:r.difficulty,start:iso(a),end:iso(b),recurrence:'none',privacy:'progress',description:r.description,createdAt:new Date().toISOString(),milestones:[25,50,75,100]};if(item.type==='improvement'){const span=7,e=new Date(a);e.setDate(e.getDate()-1);const s=new Date(e);s.setDate(s.getDate()-span+1);item.baseline=metricValue(item.metric,iso(s),iso(e));}list.push(item);saveChallenges(list);tab='mine';render();toast('Desafio adicionado à sua semana.');}

  function detail(id){const c=challenges().find(x=>x.id===id);if(!c)return;selected=id;const p=challengeProgress(c),m=METRICS[c.metric],rw=rewardConfig(c),st=status(c);const milestone=c.milestones||[25,50,75,100],feed=activityFeed(c).slice(0,12);document.getElementById('v22Panel').innerHTML=`<button class="chip-btn" data-v22-back>← Voltar</button><article class="v22-detail"><header><div><span class="pill">${statusLabel(c)} · ${scopeLabel(c)}</span><h2>${esc(c.title)}</h2><p>${esc(c.description||m.label)}</p></div><div class="v22-detail-score"><b>${p.pct}%</b><span>${esc(formatValue(c,p))}</span></div></header><div class="v22-progress big"><span style="width:${p.pct}%"></span></div><div class="v22-milestones">${milestone.map(x=>`<div class="${p.pct>=x?'hit':''}"><i>${p.pct>=x?'✓':x+'%'}</i><span>${x===100?'Meta final':'Marco '+x+'%'}</span></div>`).join('')}</div><div class="v22-detail-grid"><section class="card"><h3>Regras</h3><p>${esc(TYPES[c.type])} · ${esc(m.label)}</p><p>${fmt(c.start)} até ${fmt(c.end)} · ${esc(DIFFICULTY[c.difficulty]?.label||'Iniciante')}</p><p>${c.recurrence==='weekly'?'Renova toda semana':c.recurrence==='monthly'?'Renova todo mês':'Não recorrente'}</p>${c.metric==='weight_change_pct'?'<p>O peso absoluto não é mostrado aqui; somente o percentual de evolução.</p>':''}</section><section class="card"><h3>Recompensa</h3><div class="v22-prize"><b>+${rw.xp}</b><span>XP de desafio</span><b>+${rw.coins}</b><span>MetaCoins</span></div><p class="muted">A recompensa é liberada uma única vez ao chegar em 100%.</p></section></div><section class="card"><div class="v22-section-head"><div><h3>Feed do desafio</h3><p>Gerado automaticamente a partir dos seus registros.</p></div></div>${feed.length?feed.map(e=>`<div class="v22-feed"><span>${e.icon}</span><div><b>${esc(e.title)}</b><small>${fmt(e.day)} · ${esc(e.detail)}</small></div></div>`).join(''):'<p class="muted">Registre atividades no MetaLife para preencher o feed.</p>'}</section><div class="v22-detail-actions"><button class="secondary" data-v22-edit="${esc(c.id)}">Editar</button><button class="chip-btn" data-v22-code="${esc(c.id)}">Compartilhar código</button>${st==='completed'?`<button class="primary" data-v22-share="${esc(c.id)}">Compartilhar resultado</button>`:''}${c.scope!=='solo'?'<button class="primary" data-v22-social>Ranking ao vivo</button>':''}<button class="chip-btn danger" data-v22-delete="${esc(c.id)}">Excluir</button></div></article>`;}

  function activityFeed(c){const s=stateSafe(),out=[];workouts().filter(x=>inRange(x,c.start,c.end)).forEach(x=>out.push({day:dateOf(x),icon:'🏋',title:x.name||x.title||'Treino concluído',detail:`${Math.round(num(x.minutes||num(x.duration)/60))} min`}));arr(s.tasks).filter(x=>inRange(x,c.start,c.end)&&done(x)).forEach(x=>out.push({day:dateOf(x),icon:'✓',title:x.title||x.name||'Tarefa concluída',detail:'Produtividade'}));arr(s.daily).filter(x=>inRange(x,c.start,c.end)&&done(x)).forEach(x=>out.push({day:dateOf(x),icon:String(x.category).toLowerCase()==='cardio'?'🏃':'●',title:x.title||x.category||'Ação concluída',detail:`${x.category||'Meu Dia'} · ${x.value||0}/${x.target||0} ${x.unit||''}`}));return out.filter(x=>x.day).sort((a,b)=>b.day.localeCompare(a.day));}

  async function social(){try{await window.mlLoadFeatures?.();if(window.Competitions?.render)window.Competitions.render();else toast('Competições ainda estão carregando.');}catch{toast('Não foi possível abrir as competições agora.');}}
  function encode(c){return btoa(unescape(encodeURIComponent(JSON.stringify({type:'metalife-challenge',v:22,challenge:{title:c.title,metric:c.metric,type:c.type,target:c.target,scope:c.scope,difficulty:c.difficulty,recurrence:c.recurrence,privacy:c.privacy,direction:c.direction,description:c.description}})))).replace(/=+$/,'');}
  function decode(token){return JSON.parse(decodeURIComponent(escape(atob(token.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(token.length/4)*4,'=')))));}
  async function copyCode(id){const c=challenges().find(x=>x.id===id);if(!c)return;const code=encode(c);try{await navigator.clipboard.writeText(code);toast('Código do desafio copiado.');}catch{openModal('Código do desafio',`<textarea rows="8" readonly>${esc(code)}</textarea>`);}}
  function importModal(){openModal('Importar desafio','<form id="v22ImportForm"><label>Código do desafio<textarea name="code" rows="7" required placeholder="Cole o código recebido"></textarea></label><button class="primary">Importar</button></form>');}
  function importCode(form){try{const obj=decode(form.elements.code.value.trim());if(obj.type!=='metalife-challenge'||!obj.challenge)throw Error();const c=obj.challenge,a=weekStart(),b=weekEnd();challengesPush({...c,id:uid('CH'),start:iso(a),end:iso(b),createdAt:new Date().toISOString(),milestones:[25,50,75,100]});closeModal();tab='mine';render();toast('Desafio importado.');}catch{toast('Código de desafio inválido.');}}
  function challengesPush(c){const list=challenges();list.push(c);saveChallenges(list);}
  async function shareResult(id){const c=challenges().find(x=>x.id===id);if(!c)return;const p=challengeProgress(c),text=`🏆 MetaLife — ${c.title}\n${p.pct}% concluído · ${formatValue(c,p)}\n${fmt(c.start)} → ${fmt(c.end)}`;if(navigator.share){try{await navigator.share({title:'Resultado MetaLife',text});return}catch{}}try{await navigator.clipboard.writeText(text);toast('Resultado copiado para compartilhar.');}catch{toast('Não foi possível compartilhar agora.');}}

  document.addEventListener('submit',e=>{if(e.target.id==='v22ChallengeForm'){e.preventDefault();submit(e.target);}if(e.target.id==='v22ImportForm'){e.preventDefault();importCode(e.target);}});
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-v22-tab]');if(t){tab=t.dataset.v22Tab;paint();return;}
    if(e.target.closest('[data-v22-new]')){formModal();return;}
    if(e.target.closest('[data-v22-social]')){social();return;}
    if(e.target.closest('[data-v22-import]')){importModal();return;}
    if(e.target.closest('[data-v22-classic]')){legacyRender?.();return;}
    const j=e.target.closest('[data-v22-join]');if(j){joinRecommendation(num(j.dataset.v22Join));return;}
    const o=e.target.closest('[data-v22-open]');if(o){detail(o.dataset.v22Open);return;}
    if(e.target.closest('[data-v22-back]')){paint();return;}
    const ed=e.target.closest('[data-v22-edit]');if(ed){formModal(challenges().find(x=>x.id===ed.dataset.v22Edit));return;}
    const co=e.target.closest('[data-v22-code]');if(co){copyCode(co.dataset.v22Code);return;}
    const sh=e.target.closest('[data-v22-share]');if(sh){shareResult(sh.dataset.v22Share);return;}
    const del=e.target.closest('[data-v22-delete]');if(del&&confirm('Excluir este desafio?')){saveChallenges(challenges().filter(x=>x.id!==del.dataset.v22Delete));tab='mine';render();return;}
  });

  window.MetaLifeChallengesV22={render,progress:challengeProgress,seasonData,recommended,legacy:legacyRender};
  window.renderChallenges=render;
})();
