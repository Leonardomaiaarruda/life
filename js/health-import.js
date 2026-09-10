/* Local GPX/TCX parsing: GPS coordinates never leave this browser. */
window.HealthImport=(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let preview=null,records=[];
  async function request(action,data={}){const token=localStorage.ml_token,r=await API.call(action,data);if(token!==localStorage.ml_token)throw Error('A conta mudou. Abra a tela novamente.');if(!r?.ok)throw Error(r?.error==='Ação inválida'?'Atualize Code.gs e execute setupCommunity.':r?.error||'Não foi possível concluir.');return r;}
  const descendants=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
  function parse(xml){
    if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Arquivo XML com declarações não permitidas.');
    const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('Arquivo inválido. Exporte novamente em GPX ou TCX.');
    const root=doc.documentElement.localName;let title='',distance=0,times=[],duration=0;
    if(root==='gpx'){
      const tracks=descendants(doc,'trk');if(tracks.length!==1)throw Error('Importe um arquivo com uma única atividade.');
      title=descendants(tracks[0],'name')[0]?.textContent||'Atividade importada';
      const segments=descendants(tracks[0],'trkseg');let count=0;
      for(const seg of segments){let prev=null;const segmentTimes=[];
        for(const p of descendants(seg,'trkpt')){if(++count>100000)throw Error('Atividade com pontos demais.');const lat=Number(p.getAttribute('lat')),lon=Number(p.getAttribute('lon'));if(!p.hasAttribute('lat')||!p.hasAttribute('lon')||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)throw Error('Coordenadas inválidas.');
          if(prev){const rad=n=>n*Math.PI/180,a=Math.sin(rad(lat-prev.lat)/2)**2+Math.cos(rad(prev.lat))*Math.cos(rad(lat))*Math.sin(rad(lon-prev.lon)/2)**2;distance+=6371*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));}prev={lat,lon};
          const time=Date.parse(descendants(p,'time')[0]?.textContent||'');if(Number.isFinite(time)){times.push(time);segmentTimes.push(time);}
        }
        if(segmentTimes.length>1)duration+=(segmentTimes.reduce((a,b)=>Math.max(a,b),-Infinity)-segmentTimes.reduce((a,b)=>Math.min(a,b),Infinity))/60000;
      }
    }else if(root==='TrainingCenterDatabase'){
      const activities=descendants(doc,'Activity');if(activities.length!==1)throw Error('Importe um arquivo com uma única atividade.');
      title='Atividade '+(activities[0].getAttribute('Sport')||'importada');
      const laps=descendants(activities[0],'Lap');
      for(const lap of laps){const direct=n=>[...lap.children].find(c=>c.localName===n)?.textContent;const meters=Number(direct('DistanceMeters')),seconds=Number(direct('TotalTimeSeconds'));if(!Number.isFinite(meters)||meters<0||!Number.isFinite(seconds)||seconds<0)throw Error('Distância ou duração inválida.');distance+=meters/1000;duration+=seconds/60;const start=Date.parse(lap.getAttribute('StartTime'));if(Number.isFinite(start))times.push(start);}
    }else throw Error('Use GPX ou TCX exportado pelo seu aplicativo de atividade.');
    if(!times.length)throw Error('O arquivo precisa incluir a data e o horário da atividade.');
    const first=new Date(times.reduce((a,b)=>Math.min(a,b),Infinity)),date=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(first);
    if(!Number.isFinite(duration)||duration<0||duration>1440||!Number.isFinite(distance)||distance<0||distance>500)throw Error('Atividade fora dos limites de 24 horas ou 500 km.');
    return {title:title.slice(0,100),date,duration:Math.round(duration*100)/100,distance:Math.round(distance*100)/100,category:'run'};
  }
  async function render(){
    document.getElementById('content').innerHTML='<section class="community-page card"><button class="chip-btn" onclick="show(\'Comunidade\')">← Comunidade</button><h2>Atividades de dispositivos</h2><p>Importe uma atividade exportada pelo seu relógio ou aplicativo em GPX ou TCX. A importação é manual.</p><p>Somente data, título, duração e distância serão salvos na sua conta. Coordenadas e o arquivo original ficam fora do envio. Revise os valores antes de confirmar.</p><label>Arquivo GPX ou TCX (até 10 MB)<input id="healthFile" type="file" accept=".gpx,.tcx,application/gpx+xml,application/xml,text/xml"></label><div id="healthPreview" aria-live="polite"></div><h3>Minhas atividades importadas</h3><div id="healthRecords">Carregando…</div></section>';
    await load();
  }
  async function load(){const host=document.getElementById('healthRecords');try{records=(await request('listHealthRecords')).items;if(!host?.isConnected)return;host.innerHTML=records.length?records.map(r=>`<article class="competition-entry"><strong>${esc(r.title)}</strong><p>${esc(r.date)} · ${r.duration} min · ${r.distance} km · 🔒 Só eu</p><button class="chip-btn" data-health="delete" data-id="${esc(r.id)}">Excluir atividade</button></article>`).join(''):'<p>Nenhuma importação ainda.</p>';}catch(e){if(host?.isConnected)host.textContent=e.message;}}
  async function progress(){
    openModal('Meu progresso completo','<div id="unifiedProgress">Calculando progresso…</div>');const host=document.getElementById('unifiedProgress');
    try{const r=await request('getUnifiedProgress');if(!host.isConnected)return;const labels={workout:'Treinos',run:'Corridas',goal:'Metas e ações diárias',habit:'Hábitos',diet:'Dieta',weight:'Peso',weekly:'Revisões semanais'};
      host.innerHTML=`<span class="pill">${esc(r.level)}</span><div class="social-stat-grid"><div><b>${r.xp}</b><span>XP integrado</span></div><div><b>${r.active_days}</b><span>dias ativos</span></div><div><b>${r.streak}</b><span>sequência atual</span></div><div><b>${r.best_streak}</b><span>melhor sequência</span></div></div><h3>De onde vêm os pontos</h3>${Object.entries(r.by_category).map(([k,v])=>`<p>${esc(labels[k]||k)}: ${v} XP</p>`).join('')}<p>Considera registros pessoais concluídos, check-ins e atividades importadas. Uma pontuação por categoria e dia evita contar duas vezes o treino que você também publicou. Limite de 100 XP por dia e bônus de 50 a cada 7 dias seguidos.</p><p>Este resumo é privado. Rankings sociais usam somente check-ins compartilhados. O contador antigo de XP permanece disponível no painel por compatibilidade.</p>`;
    }catch(e){if(host.isConnected)host.textContent=e.message;}
  }
  document.addEventListener('change',async e=>{
    if(e.target.id!=='healthFile')return;const file=e.target.files[0],host=document.getElementById('healthPreview');preview=null;if(!file){host.textContent='';return;}host.textContent='Lendo atividade…';
    try{if(file.size>10*1024*1024)throw Error('Escolha um arquivo de até 10 MB.');const data=await file.arrayBuffer();const item=parse(new TextDecoder().decode(data));const digest=await crypto.subtle.digest('SHA-256',data);item.id='health_'+Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');if(!host.isConnected)return;preview=item;
      host.innerHTML=`<form id="healthForm"><h3>Revise a atividade</h3><label>Título<input name="title" value="${esc(item.title)}" required maxlength="100"></label><label>Tipo<select name="category"><option value="run">Corrida</option><option value="workout">Treino / outra atividade</option></select></label><p>${esc(item.date)} · ${item.duration} minutos · ${item.distance} km</p><p>A duração do GPX corresponde ao intervalo dos pontos de cada trecho e pode incluir pausas. Confira os valores no aplicativo de origem.</p><p role="status"></p><button class="primary" type="submit">Salvar somente na minha conta</button></form>`;
    }catch(error){if(host.isConnected)host.textContent=error.message;}
  });
  document.addEventListener('submit',async e=>{const f=e.target;if(f.id!=='healthForm')return;e.preventDefault();if(f.dataset.busy||!preview)return;f.dataset.busy='1';const b=f.querySelector('button');b.disabled=true;try{await request('saveHealthRecord',{item:{...preview,...Object.fromEntries(new FormData(f))}});if(f.isConnected)f.innerHTML='<p>Atividade salva na sua conta. Ela não foi publicada no feed.</p>';await load();}catch(error){f.querySelector('[role=status]').textContent=error.message;}finally{delete f.dataset.busy;b.disabled=false;}});
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-health]');if(!b||b.disabled)return;if(b.dataset.health==='delete'&&confirm('Excluir esta atividade importada da sua conta?')){b.disabled=true;try{await request('deleteHealthRecord',{id:b.dataset.id});await load();}catch(error){toast(error.message);}finally{b.disabled=false;}}});
  return {render,progress,parse};
})();
