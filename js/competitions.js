window.Competitions=(()=>{
  const metrics={days:'Dias ativos',workouts:'Treinos',minutes:'Minutos de treino/corrida',distance:'Quilômetros de corrida',habits:'Hábitos concluídos',xp:'XP social',custom:'Pontos por atividade'};
  const categories={workout:'Treino',run:'Corrida',diet:'Dieta',habit:'Hábito',weight:'Peso',goal:'Meta',weekly:'Revisão semanal'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const me=()=>String(localStorage.ml_user_id||'');
  let items=[],epoch=0,selected='',draftId='';
  async function request(action,data={}){
    const token=localStorage.ml_token,result=await API.call(action,data);
    if(token!==localStorage.ml_token)throw Error('A conta mudou. Abra os desafios novamente.');
    if(!result?.ok)throw Error(result?.error==='Ação inválida'?'Atualize o Code.gs e execute setupCompetitions no Apps Script.':result?.error||'Não foi possível concluir. Tente novamente.');
    return result;
  }
  const status=c=>c.cancelled?'Cancelado':iso()>c.end?'Encerrado':iso()<c.start?'Ainda não começou':'Em andamento';
  const member=c=>c.members.find(m=>m.user_id===me());
  const rules=c=>`${metrics[c.metric]} · Limite de ${c.daily_cap} por pessoa/dia · ${c.photo_required?'Foto obrigatória':'Foto opcional'}`;
  async function render(){
    const run=++epoch;selected='';
    document.getElementById('content').innerHTML=`<section class="competition-page"><header class="section-head"><div><h2>Competições</h2><p class="muted">Uma meta em comum. Cada check-in conta.</p></div><button class="primary" data-comp="new">＋ Criar competição</button></header><button class="chip-btn" onclick="show('Desafios')">← Desafios tradicionais</button><div id="competitionBody" aria-live="polite">Carregando competições…</div></section>`;
    const host=document.getElementById('competitionBody');
    if(!localStorage.ml_token){host.textContent='Entre na sua conta para competir com amigos.';return;}
    try{items=(await request('listCompetitions')).items;if(run!==epoch||!host.isConnected)return;
      host.innerHTML=items.length?`<div class="competition-cards">${items.map(c=>`<article class="card"><span class="pill">${esc(status(c))} · ${c.format==='teams'?'Por times':'Individual'}</span><h3>${esc(c.title)}</h3><p>${esc(rules(c))}</p><p>${esc(c.start.split('-').reverse().join('/'))} a ${esc(c.end.split('-').reverse().join('/'))}</p><small>${c.members.filter(m=>m.status==='accepted').length} participantes ativos${member(c).status==='pending'?' · Convite pendente':''}</small><p><button class="primary" data-comp="open" data-id="${esc(c.id)}">${member(c).status==='pending'?'Ver convite':'Abrir ranking'}</button></p></article>`).join('')}</div>`:'<div class="card"><h3>Seu próximo desafio começa aqui</h3><p>Crie uma competição e convide amigos para evoluir juntos.</p></div>';
    }catch(e){if(host.isConnected)host.textContent=e.message;}
  }
  async function create(){
    if(!localStorage.ml_token){toast('Entre na sua conta.');return;}
    openModal('Nova competição','<p id="competitionLoading">Carregando amigos…</p>');
    const host=document.getElementById('competitionLoading');
    try{
      const result=await request('listFriends');if(!host.isConnected)return;
      const friends=result.items||result.friends||[];
      draftId=crypto.randomUUID();
      const people=[{id:me(),name:'Você'},...friends.filter(f=>String(f.id||f.user_id)!==me())];
      openModal('Nova competição',`<form id="competitionForm"><div class="field"><label for="competitionTitle">Nome</label><input id="competitionTitle" name="title" required maxlength="80" placeholder="Ex.: Setembro em movimento"></div><div class="form-grid"><div class="field"><label>Formato<select name="format" id="competitionFormat"><option value="individual">Individual</option><option value="teams">Por times</option></select></label></div><div class="field"><label>Pontuação<select name="metric" id="competitionMetric">${Object.entries(metrics).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></div><div class="field"><label>Início<input name="start" type="date" required min="${iso()}" value="${iso()}"></label></div><div class="field"><label>Fim<input name="end" type="date" required min="${iso()}" value="${iso()}"></label></div><div class="field"><label>Limite de pontos por pessoa/dia<input name="daily_cap" type="number" min="0.01" max="10000" step="0.01" value="1" required></label></div></div><p class="muted">Em dias ativos, no máximo 1 ponto por dia. Minutos e distância contam apenas treino/corrida elegíveis.</p><label class="competition-check"><input name="photo_required" type="checkbox"> Exigir foto nos check-ins que pontuam</label><div id="competitionWeights" hidden><h4>Pontos por check-in</h4><div class="form-grid">${Object.entries(categories).map(([v,l])=>`<label>${l}<input name="weight_${v}" type="number" min="0" max="1000" value="10"></label>`).join('')}</div></div><div id="competitionTeams" hidden><label>Nomes dos times (um por linha, de 2 a 6)<textarea id="competitionTeamNames" rows="3">Time Azul\nTime Verde</textarea></label><button type="button" class="chip-btn" data-comp="teams">Aplicar nomes dos times</button><p class="muted">A pontuação do time é a soma dos participantes. Equipes do mesmo tamanho tornam a disputa mais equilibrada.</p></div><h4>Participantes e times</h4><div class="competition-people">${people.map(p=>`<div class="competition-person" data-person="${esc(p.id||p.user_id)}"><label><input type="checkbox" ${String(p.id||p.user_id)===me()?'checked disabled':''}> ${esc(p.name||p.nome||'Amigo')}</label><select aria-label="Time de ${esc(p.name||p.nome||'participante')}" hidden></select></div>`).join('')}</div>${people.length<2?'<p>Adicione um amigo em Pessoas antes de criar uma competição.</p>':''}<p class="muted">As regras e os times ficam fixos após criar. Ao participar, você compartilha com os participantes os títulos, métricas e fotos dos check-ins publicados para amigos a partir do aceite. Registros “Só eu” não contam. Todos os check-ins são manuais e autodeclarados.</p><label class="competition-check"><input name="consent" type="checkbox" required> Concordo em compartilhar meus check-ins elegíveis nesta competição.</label><p role="status"></p><button class="primary" type="submit">Criar e convidar</button></form>`);
      teams();
    }catch(e){if(host.isConnected)host.textContent=e.message;}
  }
  function teams(){
    const form=document.getElementById('competitionForm');if(!form)return;
    const teamMode=form.elements.format.value==='teams',names=document.getElementById('competitionTeamNames').value.split('\n').map(v=>v.trim()).filter(Boolean);
    document.getElementById('competitionTeams').hidden=!teamMode;
    form.querySelectorAll('[data-person] select').forEach(select=>{const old=select.value;select.hidden=!teamMode;select.innerHTML=names.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join('');if([...select.options].some(o=>o.value===old))select.value=old;});
  }
  async function submit(form){
    if(form.dataset.busy)return;form.dataset.busy='1';const button=form.querySelector('[type="submit"]'),msg=form.querySelector('[role="status"]');button.disabled=true;msg.textContent='Criando competição…';
    try{
      if(!form.elements.consent.checked)throw Error('Confirme o compartilhamento dos check-ins.');
      const fields=Object.fromEntries(new FormData(form)),weights={};Object.keys(categories).forEach(k=>weights[k]=Number(fields['weight_'+k]));
      const members=[...form.querySelectorAll('[data-person]')].filter(row=>row.querySelector('input').checked).map(row=>({user_id:row.dataset.person,team:Number(row.querySelector('select').value)}));
      const item={...fields,id:draftId,weights,members,photo_required:form.elements.photo_required.checked,teams:document.getElementById('competitionTeamNames').value.split('\n').map(v=>v.trim()).filter(Boolean)};
      await request('createCompetition',{item});if(form.isConnected)closeModal();toast('Competição criada. Seus amigos precisam aceitar o convite.');await render();
    }catch(e){msg.textContent=e.message;}finally{delete form.dataset.busy;button.disabled=false;}
  }
  async function open(id){
    const c=items.find(c=>c.id===id);if(!c)return;selected=id;
    const host=document.getElementById('competitionBody');if(!host)return;
    const m=member(c),pending=m.status==='pending';
    host.innerHTML=`<section class="card competition-detail"><button class="chip-btn" data-comp="back">← Todas as competições</button><h2>${esc(c.title)}</h2><p>${esc(status(c))} · ${esc(c.start)} a ${esc(c.end)}</p><p>${esc(rules(c))}</p>${c.metric==='custom'?`<p>${Object.entries(c.weights).map(([k,v])=>`${categories[k]}: ${v}`).join(' · ')}</p>`:''}<p class="muted">Contam apenas check-ins para amigos publicados depois do seu aceite e dentro do período. O limite é diário e individual. Empates compartilham a posição. Excluir um check-in retira seus pontos.</p><details><summary>Participantes e convites</summary><ul>${c.members.map(p=>`<li>${esc(p.name)}${c.format==='teams'?' · '+esc(c.teams[p.team]):''} · ${{pending:'Convidado',accepted:'Participando',rejected:'Recusou',left:'Saiu'}[p.status]}</li>`).join('')}</ul></details>${pending?'<p>Ao aceitar, os participantes poderão ver o título e a foto dos seus check-ins elegíveis. Os registros privados continuam privados.</p><button class="primary" data-comp="accept">Aceitar e participar</button> <button class="chip-btn" data-comp="reject">Recusar</button>':`<div class="competition-actions"><button class="primary" data-comp="checkin">Fazer check-in</button><button class="chip-btn" data-comp="refresh">Atualizar ranking</button>${!c.cancelled&&iso()<=c.end?`<button class="chip-btn" data-comp="${c.owner===me()?'cancel':'leave'}">${c.owner===me()?'Cancelar competição':'Sair da competição'}</button>`:''}</div><div id="competitionResults">Calculando ranking…</div>`}</section>`;
    if(pending)return;
    const output=document.getElementById('competitionResults');
    try{
      const result=await request('getCompetition',{id});if(!output.isConnected||selected!==id)return;
      const rows=c.format==='teams'?result.teams:result.ranking;
      function ranking(data,individual){let position=0;return data.map((r,i)=>{if(!i||r.score!==data[i-1].score)position=i+1;return `<div class="competition-rank"><b>${position}º</b><div><strong>${esc(r.name)}</strong><small>${individual?`${r.active_days} dias ativos · melhor sequência: ${r.longest_streak} dias`:`${r.members} participantes ativos`}</small></div><b>${Number(r.score).toLocaleString('pt-BR')}</b></div>`;}).join('');}
      output.innerHTML=`<h3>Ranking ${c.format==='teams'?'dos times':'individual'}</h3>${ranking(rows,c.format!=='teams')||'<p>Nenhum participante ativo.</p>'}${c.format==='teams'?`<h3>Contribuição individual</h3>${ranking(result.ranking,true)}`:''}<h3>Check-ins da competição</h3><p class="muted">Até 100 atividades mais recentes. O ranking considera todo o período.</p>${result.feed.length?result.feed.map(p=>`<article class="competition-entry"><strong>${esc(p.name)}</strong><small>${esc(p.day)}</small><p>${esc(p.title)}</p><span class="pill">+${Number(p.points).toLocaleString('pt-BR')} pontos</span>${p.has_photo?` <button class="chip-btn" data-comp="photo" data-post="${esc(p.id)}">Ver foto</button>`:''}</article>`).join(''):'<p>Os primeiros check-ins vão aparecer aqui. Publique na Comunidade com visibilidade “Meus amigos”.</p>'}`;
    }catch(e){if(output.isConnected)output.textContent=e.message;}
  }
  document.addEventListener('submit',e=>{if(e.target.id==='competitionForm'){e.preventDefault();submit(e.target);}});
  document.addEventListener('change',e=>{if(e.target.id==='competitionFormat')teams();if(e.target.id==='competitionMetric')document.getElementById('competitionWeights').hidden=e.target.value!=='custom';});
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-comp]');if(!button||button.disabled)return;
    const action=button.dataset.comp;
    if(action==='new'){await create();return;}if(action==='teams'){teams();return;}if(action==='back'){await render();return;}
    if(action==='open'||action==='refresh'){await open(button.dataset.id||selected);return;}
    if(action==='checkin'){show('Comunidade');toast('Faça um check-in para Meus amigos. Confira as regras de foto e pontuação do desafio.');return;}
    button.disabled=true;
    try{
      if(action==='photo'){
        const r=await request('getCompetitionPhoto',{id:selected,post_id:button.dataset.post});
        if(button.isConnected&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(r.photo)){const img=new Image();img.src=r.photo;img.alt='Foto compartilhada no desafio';img.className='social-preview';button.replaceWith(img);}return;
      }
      const statuses={accept:'accepted',reject:'rejected',leave:'left',cancel:'cancelled'};
      if(statuses[action]){
        if(['leave','cancel'].includes(action)&&!confirm(action==='cancel'?'Cancelar esta competição para todos?':'Sair desta competição? Sua pontuação sairá do ranking.'))return;
        await request('respondCompetition',{id:selected,status:statuses[action]});await render();
      }
    }catch(error){toast(error.message);}finally{button.disabled=false;}
  });
  return {render};
})();
