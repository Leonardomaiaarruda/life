/* Community is separate from personal records; publishing is always explicit. */
window.Social = (() => {
  const labels={workout:'Treino',run:'Corrida',diet:'Dieta',habit:'Hábito',weight:'Peso',goal:'Meta',weekly:'Revisão semanal'};
  const icons={workout:'🏋',run:'🏃',diet:'🥗',habit:'🔥',weight:'⚖',goal:'🎯',weekly:'📅'};
  const reactions={fire:'🔥',strength:'💪',clap:'👏',heart:'❤️'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let tab='feed',filter='',items=[],next=null,epoch=0,busy=false,composeId='',photo='',photoBusy=false;
  const user=()=>String(localStorage.ml_user_id||'');
  const active=()=>currentPage==='Comunidade';
  async function request(action,data={}) {
    const token=localStorage.ml_token;
    const result=await API.call(action,data);
    if(token!==localStorage.ml_token)throw Error('A conta mudou. Abra a Comunidade novamente.');
    if(!result?.ok)throw Error(result?.error==='Ação inválida'?'Atualize o Code.gs e execute setupSocial para ativar a Comunidade.':result?.error||'Não foi possível concluir. Tente novamente.');
    return result;
  }
  function errorAt(host,error){if(host){host.innerHTML='<div class="social-empty" role="alert"></div>';host.firstChild.textContent=error.message;}}
  function shell() {
    return `<div class="social-page"><header class="social-heading"><div><div class="eyebrow">EVOLUÇÃO EM COMPANHIA</div><h2>Um passo de cada vez.<br>Melhor com amigos.</h2><p>Compartilhe conquistas e incentive quem está ao seu lado.</p></div><button class="primary" data-social="compose">＋ Fazer check-in</button></header>
      <nav class="social-tabs" aria-label="Comunidade">${[['feed','Feed'],['mine','Meus check-ins'],['ranking','Ranking'],['profile','Meu perfil']].map(([id,label])=>`<button class="chip-btn ${tab===id?'selected':''}" aria-pressed="${tab===id}" data-social="tab" data-tab="${id}">${label}</button>`).join('')}<button class="chip-btn" data-social="friends">Amigos</button></nav>
      <div id="socialBody" aria-live="polite"></div></div>`;
  }
  async function render() {
    const run=++epoch;busy=false;items=[];next=null;
    document.getElementById('content').innerHTML=shell();
    const host=document.getElementById('socialBody');
    if(!localStorage.ml_token){host.innerHTML='<div class="social-empty">Entre na sua conta para compartilhar check-ins com amigos. A demonstração não publica atividades.</div>';return;}
    if(tab==='ranking'||tab==='profile'){await summary(run);return;}
    host.innerHTML=`<div class="social-filters"><label>Atividade <select id="socialFilter"><option value="">Todas</option>${Object.entries(labels).map(([key,label])=>`<option value="${key}" ${filter===key?'selected':''}>${label}</option>`).join('')}</select></label><button class="chip-btn" data-social="refresh">Atualizar</button></div><div id="socialFeed"><div class="social-empty">Carregando atividades…</div></div><button id="socialMore" class="secondary" data-social="more" hidden>Carregar mais</button>`;
    await load(false,run);
  }
  async function load(more=false,run=epoch) {
    if(busy)return;busy=true;
    try {
      const result=await request('listSocialFeed',{mine:tab==='mine',category:filter,before:more?next:null});
      if(run!==epoch||!active())return;
      items=more?[...items,...result.items]:result.items;next=result.next;
      document.getElementById('socialFeed').innerHTML=items.length?items.map(card).join(''):'<div class="social-empty"><strong>Seu próximo passo pode inspirar alguém.</strong><p>Publique seu primeiro check-in ou adicione amigos para acompanhar as atividades deles.</p><button class="primary" data-social="compose">Fazer meu primeiro check-in</button></div>';
      document.getElementById('socialMore').hidden=!next;
    }catch(error){if(run===epoch&&active())errorAt(document.getElementById('socialFeed'),error);}
    finally{if(run===epoch)busy=false;}
  }
  function card(post) {
    return `<article class="social-post" data-post="${esc(post.id)}"><header><div class="social-avatar" aria-hidden="true">${esc((post.name||'U').slice(0,1))}</div><div class="social-author"><strong>${esc(post.name)}</strong><small>${esc(new Date(post.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}))} · ${post.visibility==='private'?'🔒 Só eu':'Amigos'}</small></div><span class="social-xp">+${Number(post.xp)||0} XP</span></header>
      <div class="social-category">${icons[post.category]||'◉'} ${esc(labels[post.category]||post.category)}</div><h3>${esc(post.title)}</h3>${post.note?`<p class="social-note">${esc(post.note)}</p>`:''}<div class="social-metrics">${post.duration?`<span>${Number(post.duration)} min</span>`:''}${post.distance?`<span>${Number(post.distance)} km</span>`:''}${post.bonus?`<span>+${Number(post.bonus)} XP por sequência</span>`:''}</div>
      ${post.has_photo?`<button class="social-photo-load" data-social="photo" data-id="${esc(post.id)}">▧ Ver foto do check-in</button>`:''}
      <footer><div class="social-reactions">${Object.entries(reactions).map(([kind,icon])=>`<button aria-label="${{fire:'Fogo',strength:'Força',clap:'Aplausos',heart:'Coração'}[kind]}" aria-pressed="${post.my_reaction===kind}" class="${post.my_reaction===kind?'selected':''}" data-social="react" data-id="${esc(post.id)}" data-kind="${kind}">${icon} ${Number(post.reactions?.[kind])||0}</button>`).join('')}</div><button class="chip-btn" data-social="comments" data-id="${esc(post.id)}">${Number(post.comment_count)||0} comentários</button>${post.user_id===user()?`<button class="social-delete" data-social="delete" data-id="${esc(post.id)}">Excluir</button>`:''}</footer></article>`;
  }
  async function summary(run=epoch) {
    const host=document.getElementById('socialBody');host.innerHTML='<div class="social-empty">Carregando progresso social…</div>';
    try {
      const result=await request('getSocialSummary',{period:window.mlSocialPeriod||'week'});
      if(run!==epoch||!active())return;
      if(tab==='ranking')host.innerHTML=`<div class="social-filters"><div><h3>Entre amigos</h3><p>Somente check-ins compartilhados. Sem comparação de peso ou dieta.</p></div><select id="socialPeriod" aria-label="Período"><option value="week">Últimos 7 dias</option><option value="month" ${window.mlSocialPeriod==='month'?'selected':''}>Últimos 30 dias</option></select></div><div class="social-ranking">${result.ranking.map((item,index)=>`<div><span class="social-place">${index+1}</span><strong>${esc(item.name)} ${item.user_id===user()?'(você)':''}</strong><span>${Number(item.activities)} atividades</span><b>${Number(item.xp)} XP</b></div>`).join('')}</div>`;
      else {const p=result.profile;host.innerHTML=`<section class="social-profile"><div class="social-avatar large">${esc((p.name||'U').slice(0,1))}</div><h2>${esc(p.name)}</h2><span class="pill">${esc(p.level)}</span><div class="social-stat-grid"><div><b>${Number(p.xp)}</b><span>XP social</span></div><div><b>${Number(p.streak)}</b><span>dias em sequência</span></div><div><b>${Number(p.workouts)}</b><span>treinos compartilhados</span></div><div><b>${Number(p.activities)}</b><span>check-ins compartilhados</span></div></div><h3>Consistência vale mais que quantidade</h3><p>Treino e corrida: 30 XP. Dieta, peso e meta: 10 XP. Hábito: 5 XP. Revisão semanal: 40 XP, uma vez a cada 7 dias.</p><p>Uma pontuação por categoria ao dia, até 100 XP diários. A cada 7 dias seguidos, bônus de 50 XP. Check-ins privados não pontuam. Ao excluir uma publicação, seus pontos saem do perfil, mas o limite daquele dia permanece consumido.</p><small>O XP social é separado do XP pessoal já existente no MetaLife. Fotos são registros compartilhados, não validação automática da atividade.</small></section>`;}
    }catch(error){if(run===epoch&&active())errorAt(host,error);}
  }
  function compose() {
    if(!localStorage.ml_token){toast('Entre na conta para publicar.');return;}
    composeId=crypto.randomUUID();photo='';photoBusy=false;
    openModal('Compartilhar um check-in',`<form id="socialCompose"><div class="form-grid"><div class="field"><label for="socialCategory">Atividade</label><select id="socialCategory">${Object.entries(labels).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></div><div class="field"><label for="socialVisibility">Quem pode ver</label><select id="socialVisibility"><option value="private">Só eu (sem XP social)</option><option value="friends">Meus amigos</option></select></div></div><div class="field"><label for="socialTitle">O que você fez?</label><input id="socialTitle" required maxlength="100" placeholder="Ex.: concluí meu treino de hoje"></div><div class="field"><label for="socialNote">Como foi? (opcional)</label><textarea id="socialNote" maxlength="1000" rows="3" placeholder="Uma conquista, uma dificuldade ou algo que aprendeu"></textarea></div><div class="form-grid"><div class="field"><label for="socialDuration">Duração em minutos (opcional)</label><input id="socialDuration" type="number" min="0" max="1440" step="1"></div><div class="field"><label for="socialDistance">Distância em km (opcional)</label><input id="socialDistance" type="number" min="0" max="500" step="0.01"></div></div><div class="field"><label for="socialPhoto">Foto opcional</label><input id="socialPhoto" type="file" accept="image/jpeg,image/png,image/webp"><small>A foto será reduzida para economizar dados. O original não é enviado.</small><img id="socialPreview" class="social-preview" hidden alt="Prévia da foto"><button type="button" class="chip-btn" data-social="removePhoto">Remover foto</button></div><p id="socialComposeStatus" role="status">O check-in registra a data de hoje. Nada dos seus outros registros será publicado.</p><button class="primary" type="submit">Salvar check-in</button></form>`);
  }
  async function preparePhoto(file) {
    if(!file)return;
    if(file.size>12*1024*1024)throw Error('Escolha uma foto de até 12 MB.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use uma imagem JPG, PNG ou WebP.');
    const bitmap=await createImageBitmap(file);
    try {let size=640,quality=.78;const canvas=document.createElement('canvas');
      for(let attempt=0;attempt<12;attempt++){
        const scale=Math.min(1,size/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
        const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
        const result=canvas.toDataURL('image/jpeg',quality);if(result.length<=33000)return result;
        quality=Math.max(.35,quality-.08);size=Math.floor(size*.87);
      }throw Error('Não foi possível reduzir esta foto. Escolha outra.');
    }finally{bitmap.close();}
  }
  async function submit(form) {
    if(form.dataset.busy==='true'||photoBusy)return;
    const status=document.getElementById('socialComposeStatus'),button=form.querySelector('[type="submit"]');
    const payload={id:composeId,category:document.getElementById('socialCategory').value,visibility:document.getElementById('socialVisibility').value,title:document.getElementById('socialTitle').value,note:document.getElementById('socialNote').value,duration:Number(document.getElementById('socialDuration').value||0),distance:Number(document.getElementById('socialDistance').value||0),photo};
    form.dataset.busy='true';button.disabled=true;status.textContent='Salvando check-in…';
    try {const result=await request('createSocialPost',{item:payload});if(form.isConnected)closeModal();toast(`Check-in salvo${result.xp?' · +'+result.xp+' XP social':''}.`);if(active())await render();}
    catch(error){status.textContent=error.message;}
    finally{button.disabled=false;form.dataset.busy='false';}
  }
  async function comments(id) {
    openModal('Comentários','<div id="socialComments">Carregando…</div>');
    const host=document.getElementById('socialComments');
    try {const result=await request('listSocialComments',{post_id:id});if(!host.isConnected)return;
      const post=items.find(item=>item.id===id);
      host.innerHTML=`<div class="social-comment-list">${result.items.length?result.items.map(comment=>`<div class="social-comment"><b>${esc(comment.name)}</b><p>${esc(comment.text)}</p>${comment.user_id===user()||post?.user_id===user()?`<button class="social-delete" data-social="deleteComment" data-id="${esc(id)}" data-comment="${esc(comment.id)}">Excluir</button>`:''}</div>`).join(''):'<p>Seja o primeiro a incentivar.</p>'}</div><form id="socialCommentForm" data-post="${esc(id)}" data-request="${crypto.randomUUID()}"><label for="socialCommentText">Seu comentário</label><textarea id="socialCommentText" rows="3" required maxlength="500"></textarea><p role="status"></p><button class="primary" type="submit">Comentar</button></form>`;
    }catch(error){if(host.isConnected)errorAt(host,error);}
  }
  document.addEventListener('submit',async event=>{
    const form=event.target;
    if(form.id==='socialCompose'){event.preventDefault();await submit(form);}
    if(form.id==='socialCommentForm'){
      event.preventDefault();if(form.dataset.busy==='true')return;form.dataset.busy='true';const button=form.querySelector('button');button.disabled=true;
      try{await request('addSocialComment',{post_id:form.dataset.post,id:form.dataset.request,text:form.querySelector('textarea').value});await comments(form.dataset.post);}
      catch(error){form.querySelector('[role="status"]').textContent=error.message;}
      finally{form.dataset.busy='false';button.disabled=false;}
    }
  });
  document.addEventListener('change',async event=>{
    if(event.target.id==='socialFilter'){filter=event.target.value;await render();}
    if(event.target.id==='socialPeriod'){window.mlSocialPeriod=event.target.value;await summary();}
    if(event.target.id==='socialPhoto'){
      const input=event.target,form=input.closest('form'),status=form.querySelector('[role="status"]');photoBusy=true;photo='';form.querySelector('[type="submit"]').disabled=true;
      status.textContent='Preparando foto…';
      try{const result=await preparePhoto(input.files[0]);if(!form.isConnected)return;photo=result||'';const preview=document.getElementById('socialPreview');preview.src=photo;preview.hidden=!photo;status.textContent='Foto pronta. Revise a visibilidade antes de salvar.';}
      catch(error){status.textContent=error.message;input.value='';}
      finally{photoBusy=false;form.querySelector('[type="submit"]').disabled=false;}
    }
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-social]');if(!button)return;
    const action=button.dataset.social,id=button.dataset.id;
    if(action==='compose'){compose();return;}
    if(action==='friends'){show('Pessoas');return;}
    if(action==='tab'){tab=button.dataset.tab;await render();return;}
    if(action==='refresh'){await render();return;}
    if(action==='more'){await load(true);return;}
    if(action==='comments'){await comments(id);return;}
    if(action==='removePhoto'){photo='';document.getElementById('socialPhoto').value='';document.getElementById('socialPreview').hidden=true;return;}
    button.disabled=true;
    try {
      if(action==='react') {const post=items.find(item=>item.id===id);if(!post)return;const kind=post.my_reaction===button.dataset.kind?'':button.dataset.kind;await request('setSocialReaction',{post_id:id,kind});if(post.my_reaction)post.reactions[post.my_reaction]--;if(kind)post.reactions[kind]++;post.my_reaction=kind;const article=button.closest('article');if(article?.isConnected)article.outerHTML=card(post);}
      if(action==='photo'){const result=await request('getSocialPhoto',{post_id:id});if(button.isConnected&&/^data:image\/jpeg;base64,/.test(result.photo)){const image=document.createElement('img');image.src=result.photo;image.alt='Foto compartilhada no check-in';image.className='social-post-photo';button.replaceWith(image);}}
      if(action==='delete'&&confirm('Excluir este check-in? Os pontos sairão do perfil; o limite de pontuação do dia não será recuperado.')){await request('deleteSocialPost',{post_id:id});await render();}
      if(action==='deleteComment'&&confirm('Excluir este comentário?')){await request('deleteSocialComment',{post_id:id,id:button.dataset.comment});await comments(id);}
    }catch(error){toast(error.message);}
    finally{button.disabled=false;}
  });
  return {render,compose};
})();
