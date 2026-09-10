/* MetaLife V20 — Bloco 2: execução, RPE/RIR, carga e evolução. */
(() => {
  'use strict';
  const owner=()=>String(localStorage.getItem('ml_user_id')||'demo');
  const key=n=>'ml_v20_'+encodeURIComponent(owner())+'_'+n;
  const load=(n,f)=>{try{return JSON.parse(localStorage.getItem(key(n))||'null')??f}catch{return f}};
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Number(v)||0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=d=>new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
  let metric='load';
  let scheduled=false;

  function sessionRows(exerciseId){
    const lib=window.MetaLifeV20?.library||[];
    const ex=lib.find(x=>String(x.id)===String(exerciseId));
    if(!ex)return[];
    const sessions=window.MetaLifeV20?.sessions?.()||[];
    return arr(sessions).map(s=>{
      const found=arr(s.exercises).find(e=>e.name===ex.name||e.id===ex.id);
      if(!found)return null;
      const sets=arr(found.sets).filter(x=>x.done);
      if(!sets.length)return null;
      const load=Math.max(...sets.map(x=>num(x.kg)));
      const volume=sets.reduce((a,x)=>a+num(x.kg)*num(x.reps),0);
      const oneRM=Math.max(...sets.map(x=>num(x.kg)*(1+num(x.reps)/30)));
      const rpes=sets.map(x=>num(x.rpe)).filter(Boolean);
      const rirs=sets.map(x=>Number(x.rir)).filter(x=>Number.isFinite(x));
      return {date:s.date||String(s.endedAt||'').slice(0,10),load,volume,oneRM,rpe:rpes.length?rpes.reduce((a,b)=>a+b,0)/rpes.length:null,rir:rirs.length?rirs.reduce((a,b)=>a+b,0)/rirs.length:null,sets};
    }).filter(Boolean).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }

  function chart(rows,field){
    if(!rows.length)return'<p class="muted">Conclua sessões deste exercício para formar o gráfico.</p>';
    const vals=rows.map(x=>num(x[field]));
    const min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;
    const pts=vals.map((v,i)=>`${24+i*(552/Math.max(1,vals.length-1))},${154-(v-min)/span*118}`).join(' ');
    return `<svg class="v20-chart v20-stage2-chart" viewBox="0 0 600 180" preserveAspectRatio="none"><line x1="24" y1="154" x2="576" y2="154" stroke="currentColor" opacity=".16"/><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="5" vector-effect="non-scaling-stroke"/></svg><div class="v20-chart-labels"><span>${fmt(rows[0].date)}</span><span>${fmt(rows.at(-1).date)}</span></div>`;
  }

  function enhanceSets(){
    const active=load('active',null);
    if(!active?.exercises?.length)return;
    const current=active.exercises[active.current||0];
    document.querySelectorAll('.v20-set').forEach(row=>{
      if(row.dataset.stage2==='1')return;
      const source=row.querySelector('[data-v20-set][data-i]');
      const button=row.querySelector('[data-v20-done]');
      if(!source||!button)return;
      const i=num(source.dataset.i),set=current?.sets?.[i]||{};
      const label=document.createElement('label');
      label.className='v20-rpe-field';
      label.innerHTML=`RPE<input data-v20-set="rpe" data-i="${i}" type="number" min="1" max="10" step="0.5" inputmode="decimal" value="${esc(set.rpe??'')}">`;
      row.insertBefore(label,button);
      row.dataset.stage2='1';
    });

    const card=document.querySelector('.v20-execute article.card');
    if(card&&!document.getElementById('v20Stage2Hint')){
      const hint=document.createElement('div');
      hint.id='v20Stage2Hint';
      hint.className='v20-stage2-hint';
      hint.innerHTML='<b>Registro completo</b><span>Carga, repetições, RPE e RIR ficam salvos em cada série. Ao finalizar, a sessão entra automaticamente na linha do tempo.</span>';
      const list=card.querySelector('.v20-set-list');
      if(list)list.before(hint);
    }
  }

  function enhanceProgress(){
    const select=document.getElementById('v20HistoryExercise');
    const panel=document.getElementById('v20Panel');
    if(!select||!panel)return;
    const old=document.getElementById('v20Stage2Progress');
    if(old)old.remove();
    const rows=sessionRows(select.value);
    const bestLoad=rows.length?Math.max(...rows.map(x=>x.load)):0;
    const bestVolume=rows.length?Math.max(...rows.map(x=>x.volume)):0;
    const best1RM=rows.length?Math.max(...rows.map(x=>x.oneRM)):0;
    const rpeRows=rows.filter(x=>x.rpe!=null),rirRows=rows.filter(x=>x.rir!=null);
    const avgRpe=rpeRows.length?rpeRows.reduce((a,x)=>a+x.rpe,0)/rpeRows.length:null;
    const avgRir=rirRows.length?rirRows.reduce((a,x)=>a+x.rir,0)/rirRows.length:null;
    const title={load:'Carga máxima',volume:'Volume da sessão',oneRM:'1RM estimado'}[metric];
    const unit={load:'kg',volume:'kg',oneRM:'kg'}[metric];
    const article=document.createElement('article');
    article.id='v20Stage2Progress';
    article.className='card v20-stage2-progress';
    article.innerHTML=`<div class="v20-stage2-head"><div><div class="eyebrow">BLOCO 2</div><h3>Evolução avançada</h3></div><select id="v20Stage2Metric"><option value="load" ${metric==='load'?'selected':''}>Carga máxima</option><option value="volume" ${metric==='volume'?'selected':''}>Volume</option><option value="oneRM" ${metric==='oneRM'?'selected':''}>1RM estimado</option></select></div><div class="v20-stage2-kpis"><div><b>${bestLoad?bestLoad.toFixed(1):'—'}</b><span>melhor carga kg</span></div><div><b>${bestVolume?Math.round(bestVolume).toLocaleString('pt-BR'):'—'}</b><span>maior volume kg</span></div><div><b>${best1RM?best1RM.toFixed(1):'—'}</b><span>melhor 1RM estimado</span></div><div><b>${avgRpe!=null?avgRpe.toFixed(1):'—'}</b><span>RPE médio</span></div><div><b>${avgRir!=null?avgRir.toFixed(1):'—'}</b><span>RIR médio</span></div></div><h4>${title}</h4>${chart(rows,metric)}${rows.length?`<div class="v20-stage2-timeline">${rows.slice().reverse().slice(0,12).map(x=>`<div><b>${fmt(x.date)}</b><span>${x.load.toFixed(1)} kg · ${Math.round(x.volume).toLocaleString('pt-BR')} kg volume · 1RM ${x.oneRM.toFixed(1)} kg${x.rpe!=null?' · RPE '+x.rpe.toFixed(1):''}${x.rir!=null?' · RIR '+x.rir.toFixed(1):''}</span></div>`).join('')}</div>`:''}<p class="muted">O 1RM é apenas uma estimativa calculada a partir da carga e das repetições registradas.</p>`;
    panel.appendChild(article);
  }

  function apply(){
    scheduled=false;
    if(document.getElementById('pageTitle')?.textContent!=='Treino Inteligente')return;
    enhanceSets();
    enhanceProgress();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply)}

  document.addEventListener('change',e=>{
    if(e.target.id==='v20Stage2Metric'){metric=e.target.value;enhanceProgress();}
    if(e.target.id==='v20HistoryExercise')setTimeout(enhanceProgress,0);
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-v20-tab],[data-v20-next],[data-v20-prev],[data-v20-done],[data-v20-start],[data-v20-finish]'))setTimeout(schedule,0);
  });
  window.addEventListener('metalife-data-saved',schedule);

  const observer=new MutationObserver(schedule);
  function boot(){observer.observe(document.body,{childList:true,subtree:true});schedule();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
