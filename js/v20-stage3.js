/* MetaLife V20 — Bloco 3: ciclo, substituições equivalentes e sincronização multidispositivo. */
(() => {
  'use strict';
  const owner=()=>String(localStorage.getItem('ml_user_id')||'demo');
  const base=n=>'ml_v20_'+encodeURIComponent(owner())+'_'+n;
  const load=(n,f)=>{try{return JSON.parse(localStorage.getItem(base(n))||'null')??f}catch{return f}};
  const save=(n,v)=>localStorage.setItem(base(n),JSON.stringify(v));
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Number(v)||0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const deviceId=()=>window.MetaLifeV19?.deviceId?.()||localStorage.getItem('ml_device_id')||'browser';
  const state=()=>load('stage3_sync',{serverVersion:0,dirty:false,status:'local',lastSync:null,error:'',conflict:null});
  const setState=x=>save('stage3_sync',{...state(),...x});
  const plan=()=>load('plan',null);
  const profile=()=>load('profile',null);
  let syncing=false,scheduled=false;

  function stampDirty(reason='alteração local'){
    const p=plan();
    if(p){p.updatedAt=new Date().toISOString();p.deviceId=deviceId();save('plan',p);}
    setState({dirty:true,status:navigator.onLine?'pendente':'offline',reason,error:''});
    updateStatus();
  }
  function currentWeek(p=plan()){
    if(!p?.createdAt)return 1;
    const start=new Date(String(p.createdAt).slice(0,10)+'T12:00:00');
    const today=new Date();today.setHours(12,0,0,0);
    const days=Math.max(0,Math.floor((today-start)/86400000));
    return Math.floor(days/7)%8+1;
  }
  const cycle=[
    ['Base','Aprender e estabilizar cargas/repetições.'],
    ['Progressão','Tentar pequenas progressões mantendo a técnica.'],
    ['Ordem variada','Muda a ordem para alterar prioridade sem trocar todo o treino.'],
    ['Recuperação','Reduz o volume para facilitar recuperação.'],
    ['Variação A','Troca parte dos acessórios por equivalentes.'],
    ['Variação B','Mantém os principais e usa uma segunda combinação de acessórios.'],
    ['Variação + ordem','Nova ordem com substituições pontuais.'],
    ['Recuperação','Novo bloco de volume reduzido antes de reiniciar o ciclo.']
  ];
  function cycleHtml(){const w=currentWeek();return `<article class="card v20-stage3-cycle"><div class="v20-stage3-head"><div><div class="eyebrow">BLOCO 3</div><h3>Ciclo de variações · semana ${w}/8</h3></div><button class="chip-btn" data-v20-stage3-apply>Aplicar semana atual</button></div><div class="v20-cycle-grid">${cycle.map((x,i)=>`<div class="${i+1===w?'active':''}"><b>${i+1}</b><strong>${x[0]}</strong><small>${x[1]}</small></div>`).join('')}</div><p class="muted">Os exercícios principais permanecem mais estáveis; as mudanças automáticas concentram-se em ordem, acessórios e semanas de recuperação.</p></article>`}

  function alternatives(ex,library){
    const sameMuscle=library.filter(x=>x.id!==ex.id&&String(x.muscle||'')===String(ex.muscle||''));
    const samePattern=sameMuscle.filter(x=>x.pattern&&x.pattern===ex.pattern);
    return [...samePattern,...sameMuscle.filter(x=>!samePattern.includes(x))].slice(0,8);
  }
  function swapHtml(){const p=plan(),lib=window.MetaLifeV20?.library||[];if(!p?.workouts?.length)return'';return `<article class="card v20-stage3-swap"><h3>Substituições equivalentes</h3><p class="muted">Troque um exercício da ficha por outro do mesmo grupo muscular. A troca altera as próximas sessões e preserva seu histórico antigo.</p>${p.workouts.map((w,wi)=>`<section><h4>${esc(w.name)}</h4>${arr(w.exerciseIds).map((id,ei)=>{const ex=lib.find(x=>String(x.id)===String(id));if(!ex)return'';const alts=alternatives(ex,lib);return `<div class="v20-stage3-swaprow"><div><b>${esc(ex.name)}</b><small>${esc(ex.muscle||'')}</small></div>${alts.length?`<select data-v20-stage3-swap="${wi}|${ei}"><option value="">Substituir por…</option>${alts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>`:'<span class="muted">Sem equivalente cadastrado</span>'}</div>`}).join('')}</section>`).join('')}</article>`}

  function statusLabel(){const s=state();if(s.conflict)return['Conflito','warn'];if(!navigator.onLine)return['Offline','off'];if(s.status==='syncing')return['Sincronizando…','busy'];if(s.dirty)return['Pendente','warn'];if(s.status==='server')return['Sincronizado','ok'];if(s.error)return['Somente local','warn'];return['Local','local']}
  function syncHtml(){const s=state(),[label,kind]=statusLabel();return `<article class="card v20-stage3-sync"><div class="v20-stage3-head"><div><h3>Plano em vários dispositivos</h3><p class="muted">Perfil e plano podem ficar iguais no celular e no computador depois de ativar o backend V20 no Apps Script.</p></div><span class="v20-cloud ${kind}" id="v20Stage3Cloud">${label}</span></div><div class="v20-stage3-syncmeta"><span>Versão servidor: <b>${num(s.serverVersion)||'—'}</b></span><span>Última sincronização: <b>${s.lastSync?new Date(s.lastSync).toLocaleString('pt-BR'):'—'}</b></span><span>Aparelho: <b>${esc(deviceId().slice(0,18))}</b></span></div><div class="v20-stage3-actions"><button class="primary" data-v20-stage3-sync>Sincronizar agora</button>${s.conflict?'<button class="chip-btn" data-v20-stage3-use-server>Usar versão do servidor</button><button class="chip-btn" data-v20-stage3-force-local>Manter minha versão local</button>':''}</div>${s.error?`<div class="v20-stage3-warning">${esc(s.error)}</div>`:''}</article>`}

  function decorate(){
    scheduled=false;
    if(document.getElementById('pageTitle')?.textContent!=='Treino Inteligente')return;
    const host=document.getElementById('v20Panel');if(!host)return;
    const selected=document.querySelector('.v20-tabs .selected')?.dataset.v20Tab;
    if(selected==='plan'){
      if(!document.getElementById('v20Stage3Cycle')){const box=document.createElement('div');box.id='v20Stage3Cycle';box.innerHTML=cycleHtml()+swapHtml()+syncHtml();host.appendChild(box);}
    } else if(selected==='generator'){
      if(!document.getElementById('v20Stage3Sync')){const box=document.createElement('div');box.id='v20Stage3Sync';box.innerHTML=syncHtml();host.appendChild(box);}
    }
    updateStatus();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}
  function updateStatus(){const el=document.getElementById('v20Stage3Cloud');if(!el)return;const [label,kind]=statusLabel();el.textContent=label;el.className='v20-cloud '+kind}

  function applyServer(data){
    if(data.profile)save('profile',data.profile);
    if(data.plan)save('plan',data.plan);
    setState({serverVersion:num(data.version),dirty:false,status:'server',lastSync:new Date().toISOString(),error:'',conflict:null});
    window.MetaLifeV20?.render?.(document.querySelector('.v20-tabs .selected')?.dataset.v20Tab||'plan');
  }
  async function getServer(){return API.call('v20GetTrainingProfile',{device_id:deviceId()})}
  async function pushLocal(force=false,expectedVersion=null){
    const s=state(),p=plan(),prof=profile();if(!p&&!prof)return null;
    return API.call('v20SaveTrainingProfile',{profile:prof,plan:p,expected_version:expectedVersion==null?num(s.serverVersion):num(expectedVersion),force:!!force,device_id:deviceId(),client_updated_at:p?.updatedAt||p?.createdAt||new Date().toISOString()});
  }
  async function syncNow({silent=false}={}){
    if(syncing||!localStorage.ml_token)return;
    if(navigator.onLine===false){setState({status:'offline'});updateStatus();return;}
    syncing=true;setState({status:'syncing',error:''});updateStatus();
    try{
      const remote=await getServer();
      if(!remote?.ok)throw Error(remote?.error||'Backend V20 não disponível.');
      const localPlan=plan(),s=state(),remoteVersion=num(remote.version);
      if(!remote.exists){
        if(localPlan||profile()){
          const saved=await pushLocal(false,0);if(!saved?.ok)throw Error(saved?.error||'Falha ao enviar o plano.');
          if(saved.conflict){setState({status:'conflict',conflict:saved,serverVersion:num(saved.version)});return;}
          setState({serverVersion:num(saved.version),dirty:false,status:'server',lastSync:new Date().toISOString(),error:'',conflict:null});
        }
        return;
      }
      if(!localPlan&&!profile()){applyServer(remote);return;}
      if(s.dirty){
        if(remoteVersion!==num(s.serverVersion)){
          setState({status:'conflict',serverVersion:remoteVersion,conflict:remote,error:'Há alterações deste aparelho e uma versão mais nova em outro dispositivo. Escolha qual manter.'});return;
        }
        const saved=await pushLocal(false,remoteVersion);if(saved?.conflict){setState({status:'conflict',serverVersion:num(saved.version),conflict:saved,error:'Outro aparelho atualizou o plano durante a sincronização.'});return;}
        if(!saved?.ok)throw Error(saved?.error||'Falha ao enviar o plano.');
        setState({serverVersion:num(saved.version),dirty:false,status:'server',lastSync:new Date().toISOString(),error:'',conflict:null});
        return;
      }
      if(remoteVersion>num(s.serverVersion)){applyServer(remote);return;}
      setState({serverVersion:remoteVersion,dirty:false,status:'server',lastSync:new Date().toISOString(),error:'',conflict:null});
    }catch(err){
      const msg=/Ação inválida|inválida/i.test(String(err.message||''))?'Backend V20 ainda não está publicado no Apps Script. O plano continua funcionando e salvo neste aparelho.':String(err.message||'Não foi possível sincronizar.');
      setState({status:'local',error:msg});if(!silent&&typeof toast==='function')toast(msg);
    }finally{syncing=false;schedule();updateStatus();}
  }
  async function useServer(){const c=state().conflict;if(!c)return;if(c.profile||c.plan){applyServer(c);if(typeof toast==='function')toast('Versão do servidor aplicada.');}else syncNow()}
  async function forceLocal(){if(syncing)return;syncing=true;try{const s=state(),r=await pushLocal(true,num(s.serverVersion));if(!r?.ok)throw Error(r?.error||'Falha ao enviar.');setState({serverVersion:num(r.version),dirty:false,status:'server',lastSync:new Date().toISOString(),error:'',conflict:null});if(typeof toast==='function')toast('Versão local mantida e sincronizada.');}catch(e){setState({error:String(e.message),status:'local'});if(typeof toast==='function')toast(e.message)}finally{syncing=false;schedule()}}

  function applyVariation(){
    const btn=document.querySelector('[data-v20-refresh-week]');
    if(btn)btn.click();
    stampDirty('variação semanal');
    syncNow({silent:true});
    if(typeof toast==='function')toast('Variação da semana aplicada às fichas.');
  }
  function swapExercise(select){
    if(!select.value)return;const [wi,ei]=select.dataset.v20Stage3Swap.split('|').map(num),p=plan();if(!p?.workouts?.[wi])return;
    const lib=window.MetaLifeV20?.library||[],next=lib.find(x=>String(x.id)===String(select.value)),oldId=p.workouts[wi].exerciseIds[ei],old=lib.find(x=>String(x.id)===String(oldId));if(!next)return;
    p.workouts[wi].exerciseIds[ei]=next.id;p.updatedAt=new Date().toISOString();p.lastSubstitution={at:p.updatedAt,workout:p.workouts[wi].name,from:old?.name||oldId,to:next.name};save('plan',p);stampDirty('substituição de exercício');
    const refresh=document.querySelector('[data-v20-refresh-week]');if(refresh)refresh.click();
    window.MetaLifeV20?.render?.('plan');syncNow({silent:true});if(typeof toast==='function')toast(`${old?.name||'Exercício'} → ${next.name}`);
  }

  document.addEventListener('submit',e=>{if(e.target.id==='v20Generator'){setTimeout(()=>{stampDirty('novo plano gerado');syncNow({silent:true});schedule()},80)}});
  document.addEventListener('change',e=>{const sel=e.target.closest('[data-v20-stage3-swap]');if(sel)swapExercise(sel)});
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-v20-stage3-apply]')){applyVariation();return;}
    if(e.target.closest('[data-v20-stage3-sync]')){syncNow();return;}
    if(e.target.closest('[data-v20-stage3-use-server]')){useServer();return;}
    if(e.target.closest('[data-v20-stage3-force-local]')){forceLocal();return;}
    if(e.target.closest('[data-v20-refresh-week]')){setTimeout(()=>{stampDirty('variação semanal');syncNow({silent:true})},40);return;}
    if(e.target.closest('[data-v20-tab]'))setTimeout(schedule,0);
  });
  window.addEventListener('online',()=>syncNow({silent:true}));
  window.addEventListener('storage',e=>{if(e.key===base('plan')||e.key===base('profile'))schedule()});

  const observer=new MutationObserver(schedule);
  function boot(){observer.observe(document.body,{childList:true,subtree:true});schedule();setTimeout(()=>syncNow({silent:true}),1400)}
  window.MetaLifeV20Stage3={sync:syncNow,markDirty:stampDirty,currentWeek};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
