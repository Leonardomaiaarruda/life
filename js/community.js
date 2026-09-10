window.Community=(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const me=()=>String(localStorage.ml_user_id||'');let clubs=[],active='',tab='feed',next='',posts=[],epoch=0,room='',roomItems=[],roomBefore='',timer=null,chatBusy=false;
  async function request(action,data={}){const token=localStorage.ml_token,r=await API.call(action,data);if(token!==localStorage.ml_token)throw Error('A conta mudou. Abra a tela novamente.');if(!r?.ok)throw Error(r?.error==='Ação inválida'?'Atualize Code.gs e execute setupCommunity no Apps Script.':r?.error||'Não foi possível concluir. Tente novamente.');return r;}
  async function render(){
    const run=++epoch;active='';stopChat();document.getElementById('content').innerHTML='<section class="community-page"><header class="section-head"><div><h2>Grupos e clubes</h2><p>Uma comunidade para continuar evoluindo.</p></div><button class="primary" data-community="create">＋ Criar grupo</button></header><button class="chip-btn" onclick="show(\'Comunidade\')">← Comunidade</button><div id="clubBody" aria-live="polite">Carregando grupos…</div></section>';
    const host=document.getElementById('clubBody');
    try{clubs=(await request('listClubs')).items;if(run!==epoch||!host.isConnected)return;host.innerHTML=clubs.length?`<div class="competition-cards">${clubs.map(c=>`<article class="card"><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><p>${c.members.filter(m=>m.status==='accepted').length} membros · ${c.archived?'Arquivado':c.members.find(m=>m.user_id===me()).status==='pending'?'Convite pendente':'Ativo'}</p>${c.unread?`<p class="pill">${c.unread} novas mensagens</p>`:''}<button class="primary" data-community="open" data-id="${esc(c.id)}">Abrir grupo</button></article>`).join('')}</div>`:'<div class="card"><h3>Encontre sua turma</h3><p>Crie um grupo e convide amigos para compartilhar atividades.</p></div>';}
    catch(e){if(host.isConnected)host.textContent=e.message;}
  }
  async function create(){
    openModal('Criar grupo','<p id="clubWait">Carregando amigos…</p>');const wait=document.getElementById('clubWait');
    try{const r=await request('listFriends');if(!wait.isConnected)return;
      openModal('Criar grupo',`<form id="clubCreate" data-id="${crypto.randomUUID()}"><label>Nome<input name="title" required maxlength="80" placeholder="Ex.: Academia das 6h"></label><label>Descrição<textarea name="description" maxlength="500" rows="3"></textarea></label><h4>Convidar amigos</h4><div class="community-choices">${(r.friends||[]).map(f=>`<label><input type="checkbox" name="users" value="${esc(f.id)}"> ${esc(f.name)}</label>`).join('')||'<p>Você pode convidar amigos depois.</p>'}</div><p>Somente membros que aceitarem o convite têm acesso ao grupo. Check-ins são compartilhados por escolha da pessoa.</p><p role="status"></p><button class="primary" type="submit">Criar grupo</button></form>`);
    }catch(e){if(wait.isConnected)wait.textContent=e.message;}
  }
  async function open(id){
    active=id;next='';posts=[];const c=clubs.find(c=>c.id===id),host=document.getElementById('clubBody');if(!c||!host)return;const mine=c.members.find(m=>m.user_id===me());
    host.innerHTML=`<section class="card"><button class="chip-btn" data-community="back">← Todos os grupos</button><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p>${c.archived?'<p class="pill">Grupo arquivado · histórico disponível</p>':''}${mine.status==='pending'?'<p>Ao aceitar, você poderá ver publicações e mensagens novas do grupo. Seus registros pessoais não serão publicados automaticamente.</p><button class="primary" data-community="accept">Aceitar convite</button> <button class="chip-btn" data-community="reject">Recusar</button>':`<nav class="social-tabs">${[['feed','Feed'],['ranking','Ranking'],['members','Membros']].map(([t,l])=>`<button class="chip-btn ${tab===t?'selected':''}" data-community="tab" data-tab="${t}">${l}</button>`).join('')}<button class="chip-btn" data-community="chat">Chat ${c.unread?'('+c.unread+')':''}</button></nav><div id="clubPanel"></div>`}</section>`;
    if(mine.status==='pending')return;
    if(tab==='members'){await members(c);return;}
    const panel=document.getElementById('clubPanel');
    if(tab==='ranking'){panel.innerHTML='<label>Período<select id="clubPeriod"><option value="week">Últimos 7 dias</option><option value="month">Últimos 30 dias</option></select></label><label>Pontuação<select id="clubMetric"><option value="xp">XP</option><option value="days">Dias ativos</option><option value="workouts">Treinos</option><option value="minutes">Minutos</option><option value="distance">Quilômetros</option><option value="habits">Hábitos</option></select></label><div id="clubRanking">Carregando…</div>';await ranking();return;}
    panel.innerHTML=`${!c.archived?'<button class="primary" data-community="checkin">＋ Check-in neste grupo</button>':''}<p class="muted">Somente atividades compartilhadas com este grupo. Quem entra vê publicações feitas a partir do aceite.</p><div id="clubFeed">Carregando…</div><button id="clubMore" class="chip-btn" data-community="more" hidden>Carregar mais</button>`;await feed(false);
  }
  function card(p){return `<article class="social-post"><header><button class="chip-btn" data-community="profile" data-user="${esc(p.user_id)}">${esc(p.name)}</button><small>${esc(p.day)}</small><span class="pill">+${Number(p.xp)} XP</span></header><h3>${esc(p.title)}</h3>${p.note?`<p>${esc(p.note)}</p>`:''}<p>${p.duration?Number(p.duration)+' min ':''}${p.distance?Number(p.distance)+' km':''}</p>${p.has_photo?`<button class="chip-btn" data-community="photo" data-id="${esc(p.id)}">Ver foto</button>`:''}<footer>${[['fire','🔥'],['strength','💪'],['clap','👏'],['heart','❤️']].map(([k,l])=>`<button class="chip-btn" data-community="react" data-id="${esc(p.id)}" data-kind="${k}" aria-pressed="${p.my_reaction===k}">${l} ${Number(p.reactions[k]||0)}</button>`).join('')}<button class="chip-btn" data-community="comments" data-id="${esc(p.id)}">${Number(p.comment_count)} comentários</button>${p.user_id===me()?`<button class="chip-btn" data-community="deletePost" data-id="${esc(p.id)}">Excluir</button>`:''}</footer></article>`;}
  async function feed(more){const id=active,host=document.getElementById('clubFeed');try{const r=await request('getClub',{id,before:more?next:''});if(!host?.isConnected||active!==id)return;posts=more?[...posts,...r.items]:r.items;next=r.next;host.innerHTML=posts.length?posts.map(card).join(''):'<p>Nenhum check-in compartilhado ainda.</p>';document.getElementById('clubMore').hidden=!next;}catch(e){if(host?.isConnected)host.textContent=e.message;}}
  async function ranking(){const host=document.getElementById('clubRanking'),id=active;try{const r=await request('getClub',{id,period:document.getElementById('clubPeriod').value,metric:document.getElementById('clubMetric').value});if(!host.isConnected||active!==id)return;let rank=0;host.innerHTML=r.ranking.map((p,i)=>{if(!i||p.score!==r.ranking[i-1].score)rank=i+1;return `<div class="competition-rank"><b>${rank}º</b><div>${esc(p.name)}<small>${p.activities} atividades</small></div><b>${p.score.toLocaleString('pt-BR')}</b></div>`;}).join('');}catch(e){if(host.isConnected)host.textContent=e.message;}}
  async function members(c){
    const host=document.getElementById('clubPanel'),owner=c.owner===me();
    host.innerHTML=`<ul class="community-member-list">${c.members.map(m=>`<li><span>${esc(m.name)} · ${{accepted:'Membro',pending:'Convidado',left:'Saiu',removed:'Removido',rejected:'Recusou'}[m.status]} ${m.user_id===c.owner?'· Administrador':''}</span>${owner&&!c.archived&&m.user_id!==me()&&['accepted','pending'].includes(m.status)?`<button class="chip-btn" data-community="remove" data-user="${esc(m.user_id)}">Remover</button>${m.status==='accepted'?`<button class="chip-btn" data-community="transfer" data-user="${esc(m.user_id)}">Tornar administrador</button>`:''}`:''}</li>`).join('')}</ul>${!c.archived?owner?'<button class="chip-btn" data-community="editClub">Editar grupo</button> <button class="chip-btn" data-community="invite">Convidar amigo</button> <button class="chip-btn" data-community="archive">Arquivar grupo</button>':'<button class="chip-btn" data-community="leave">Sair do grupo</button>':''}`;
  }
  async function comments(id){
    openModal('Comentários','<p id="communityComments">Carregando…</p>');const host=document.getElementById('communityComments');
    try{const r=await request('listSocialComments',{post_id:id}),post=posts.find(p=>p.id===id);if(!host.isConnected)return;host.innerHTML=`${r.items.map(c=>`<div class="social-comment"><b>${esc(c.name)}</b><p>${esc(c.text)}</p>${c.user_id===me()||post?.user_id===me()?`<button class="chip-btn" data-community="deleteComment" data-id="${esc(id)}" data-comment="${esc(c.id)}">Excluir</button>`:''}</div>`).join('')}<form id="communityCommentForm" data-post="${esc(id)}" data-id="${crypto.randomUUID()}"><label>Comentário<textarea name="text" required maxlength="500"></textarea></label><p role="status"></p><button class="primary" type="submit">Comentar</button></form>`;}catch(e){if(host.isConnected)host.textContent=e.message;}
  }
  async function profile(user=me()){
    openModal('Perfil social','<div id="communityProfile">Carregando perfil…</div>');const host=document.getElementById('communityProfile');
    try{const r=await request('getSocialProfile',{target:user}),p=r.profile;if(!host.isConnected)return;
      host.innerHTML=`<h2>${esc(p.name)}</h2><p>${esc(p.bio)||'Um passo de cada vez.'}</p><span class="pill">${esc(p.level)}</span><div class="social-stat-grid"><div><b>${p.xp}</b><span>XP compartilhado</span></div><div><b>${p.streak}</b><span>dias em sequência</span></div><div><b>${p.workouts}</b><span>treinos</span></div><div><b>${p.activities}</b><span>atividades</span></div></div><h3>Conquistas</h3><p>${p.achievements.map(a=>`<span class="pill">${esc(a)}</span>`).join(' ')||'As próximas conquistas começam com um check-in.'}</p><h3>${user===me()?'Grupos':'Grupos em comum'}</h3><p>${p.groups.map(g=>esc(g.title)).join(' · ')||'Nenhum grupo para mostrar.'}</p><h3>Competições concluídas${user===me()?'':' em comum'}</h3><p>${p.challenges.map(c=>esc(c.title)).join(' · ')||'Nenhuma por enquanto.'}</p><h3>Atividades recentes</h3>${r.items.map(p=>`<p>${esc(p.day)} · ${esc(p.title)} ${p.visibility==='private'?'🔒':''}</p>`).join('')||'<p>Nenhuma atividade.</p>'}${user===me()?`<form id="communityProfileForm"><h3>Editar perfil</h3><label>Biografia<textarea name="bio" maxlength="300">${esc(p.bio)}</textarea></label><label>Quem pode abrir meu perfil<select name="visibility"><option value="private" ${p.visibility==='private'?'selected':''}>Só eu</option><option value="friends" ${p.visibility==='friends'?'selected':''}>Meus amigos</option></select></label><p>Os amigos veem apenas atividades para amigos. Grupos e competições aparecem somente quando vocês participam juntos.</p><p role="status"></p><button class="primary" type="submit">Salvar perfil</button></form>`:''}`;
    }catch(e){if(host.isConnected)host.textContent=e.message;}
  }
  function stopChat(){clearInterval(timer);timer=null;room='';roomItems=[];document.getElementById('communityChat')?.remove();document.body.classList.remove('community-chat-open');}
  function viewport(){document.documentElement.style.setProperty('--community-height',(window.visualViewport?.height||innerHeight)+'px');document.documentElement.style.setProperty('--community-top',(window.visualViewport?.offsetTop||0)+'px');}
  async function chat(value,title){
    stopChat();room=value;roomBefore='';roomItems=[];const panel=document.createElement('section');panel.id='communityChat';panel.className='community-chat';panel.setAttribute('aria-label','Conversa do grupo');
    panel.innerHTML=`<header><button class="chip-btn" data-community="closeChat" aria-label="Fechar conversa">←</button><h3>${esc(title)}</h3></header><div id="communityChatStatus" role="status"></div><div id="communityChatMessages"><p>Carregando mensagens…</p></div><form id="communityChatForm"><textarea name="text" rows="1" required maxlength="3000" placeholder="Mensagem" aria-label="Mensagem"></textarea><button type="submit" class="primary">Enviar</button></form>`;document.body.append(panel);document.body.classList.add('community-chat-open');viewport();await chatLoad();timer=setInterval(()=>{if(!document.hidden&&localStorage.ml_token&&document.getElementById('communityChat'))chatLoad();else if(!localStorage.ml_token)stopChat();},7000);
  }
  async function chatLoad(older=false){
    if(chatBusy||!room||document.hidden)return;chatBusy=true;const id=room;
    try{const r=await request('listRoomMessages',{room:id,before:older?roomBefore:''});if(room!==id)return;const box=document.getElementById('communityChatMessages');if(!box)return;
      const bottom=box.scrollHeight-box.scrollTop-box.clientHeight<80,oldHeight=box.scrollHeight;
      const merged=older?[...r.items,...roomItems]:[...roomItems,...r.items];roomItems=Array.from(new Map(merged.map(m=>[m.id,m])).values()).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));if(older||!roomBefore)roomBefore=r.before;
      box.innerHTML=`${roomBefore?'<button class="chip-btn" data-community="older">Mensagens anteriores</button>':''}${roomItems.map(m=>`<article class="community-message ${m.user_id===me()?'mine':''}"><b>${esc(m.name)}</b><p>${esc(m.text)}</p><small>${esc(new Date(m.created_at).toLocaleString('pt-BR'))}</small></article>`).join('')||'<p>Comece a conversa.</p>'}`;
      if(older)box.scrollTop=box.scrollHeight-oldHeight;else if(bottom||roomItems.length<=r.items.length)box.scrollTop=box.scrollHeight;
      document.getElementById('communityChatStatus').textContent='';if(!older&&r.items.length&&!document.hidden)await request('markRoomRead',{room:id,message_id:r.items.at(-1).id});
    }catch(e){if(room===id&&document.getElementById('communityChatStatus'))document.getElementById('communityChatStatus').textContent=e.message;}finally{chatBusy=false;}
  }
  window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&room)chatLoad();});
  document.addEventListener('change',e=>{if(['clubPeriod','clubMetric'].includes(e.target.id))ranking();});
  document.addEventListener('submit',async e=>{
    const f=e.target;if(!['clubCreate','communityCommentForm','communityProfileForm','communityChatForm','clubEditForm'].includes(f.id))return;e.preventDefault();if(f.dataset.busy)return;f.dataset.busy='1';const button=f.querySelector('[type=submit]');button.disabled=true;const msg=f.querySelector('[role=status]')||document.getElementById('communityChatStatus');
    try{const data=Object.fromEntries(new FormData(f));
      if(f.id==='clubCreate'){await request('createClub',{item:{...data,id:f.dataset.id,users:new FormData(f).getAll('users')}});closeModal();await render();}
      if(f.id==='communityCommentForm'){await request('addSocialComment',{post_id:f.dataset.post,id:f.dataset.id,text:data.text});await comments(f.dataset.post);}
      if(f.id==='communityProfileForm'){await request('saveSocialProfile',data);await profile();}
      if(f.id==='clubEditForm'){await request('manageClub',{id:active,command:'edit',...data});closeModal();await refreshClub();}
      if(f.id==='communityChatForm'){const id=room;if(f.dataset.lastText!==data.text){f.dataset.request=crypto.randomUUID();f.dataset.lastText=data.text;}
        f.dataset.request ||= crypto.randomUUID();await request('sendRoomMessage',{room:id,id:f.dataset.request,text:data.text});if(room===id){f.reset();delete f.dataset.request;await chatLoad();}}
    }catch(error){if(msg)msg.textContent=error.message;}finally{delete f.dataset.busy;button.disabled=false;}
  });
  async function refreshClub(){const id=active;clubs=(await request('listClubs')).items;if(clubs.some(c=>c.id===id))await open(id);else await render();}
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-community]');if(!b||b.disabled)return;const a=b.dataset.community,id=b.dataset.id;
    if(a==='closeChat'){stopChat();return;}if(a==='create'){await create();return;}if(a==='back'){await render();return;}if(a==='profile'){await profile(b.dataset.user);return;}
    b.disabled=true;
    try{
      if(a==='open'){tab='feed';await open(id);}if(a==='tab'){tab=b.dataset.tab;await open(active);}if(a==='more')await feed(true);if(a==='older')await chatLoad(true);
      const c=clubs.find(c=>c.id===active);
      if(a==='chat')await chat('club:'+active,c.title);
      if(a==='checkin')Social.compose(active);
      if(a==='comments')await comments(id);
      if(a==='react'){const p=posts.find(p=>p.id===id);await request('setSocialReaction',{post_id:id,kind:p.my_reaction===b.dataset.kind?'':b.dataset.kind});await feed(false);}
      if(a==='photo'){const r=await request('getSocialPhoto',{post_id:id});if(b.isConnected&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(r.photo)){const img=new Image();img.src=r.photo;img.alt='Foto do check-in';img.className='social-post-photo';b.replaceWith(img);}}
      if(a==='deletePost'&&confirm('Excluir seu check-in? Os pontos serão retirados.')){await request('deleteSocialPost',{post_id:id});await feed(false);}
      if(a==='deleteComment'&&confirm('Excluir comentário?')){await request('deleteSocialComment',{post_id:id,id:b.dataset.comment});await comments(id);}
      if(a==='editClub')openModal('Editar grupo',`<form id="clubEditForm"><label>Nome<input name="title" required maxlength="80" value="${esc(c.title)}"></label><label>Descrição<textarea name="description" maxlength="500">${esc(c.description)}</textarea></label><p role="status"></p><button class="primary" type="submit">Salvar</button></form>`);
      if(a==='invite'){const r=await request('listFriends');openModal('Convidar amigo',`<div class="community-choices">${r.friends.filter(f=>!c.members.some(m=>m.user_id===String(f.id)&&['pending','accepted'].includes(m.status))).map(f=>`<button class="chip-btn" data-community="sendInvite" data-user="${esc(f.id)}">${esc(f.name)}</button>`).join('')||'Todos os seus amigos já estão convidados.'}</div>`);}
      if(a==='sendInvite'){await request('manageClub',{id:active,command:'invite',target:b.dataset.user});closeModal();await refreshClub();}
      if(['accept','reject','leave','remove','transfer','archive'].includes(a)){
        if(['leave','remove','transfer','archive'].includes(a)&&!confirm({leave:'Sair do grupo e perder acesso ao feed e ao chat?',remove:'Remover este membro? Ele perderá acesso ao grupo.',transfer:'Transferir a administração? Você deixará de administrar este grupo.',archive:'Arquivar o grupo? O histórico ficará disponível, mas não será possível publicar ou conversar.'}[a]))return;
        await request('manageClub',{id:active,command:a,target:b.dataset.user});await refreshClub();
      }
    }catch(error){toast(error.message);}finally{b.disabled=false;}
  });
  return {render,profile,chat,stopChat,comments};
})();
