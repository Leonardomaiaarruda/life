/* Durable personal-data operations. Chat/social actions are never replayed. */
window.Sync = (() => {
  const supported = /^(save|delete)(Daily|Goal|Weight|Task|Workout|Diet|Habit|Checkin|WeeklyReview)$/;
  let running = null;
  let lastSaved = false;
  const owner = () => localStorage.getItem('ml_user_id');
  const key = id => 'ml_pending_v1_' + encodeURIComponent(id);
  const locked = (id, task) => navigator.locks ? navigator.locks.request(key(id), task) : task();
  function read(id = owner()) { try { return JSON.parse(localStorage.getItem(key(id)) || '[]'); } catch { throw Error('Fila de alterações ilegível.'); } }
  function write(id, queue) { localStorage.setItem(key(id), JSON.stringify(queue)); }
  function render() {
    if (!document.querySelector('.topbar')) return;
    let host = document.getElementById('syncStatus');
    if (!host) {
      host = document.createElement('div'); host.id='syncStatus'; host.className='sync-status';
      host.innerHTML='<span role="status" aria-live="polite"></span><button type="button" class="chip-btn">Tentar novamente</button>';
      host.querySelector('button').onclick=()=>flush();
      document.querySelector('.topbar').after(host);
    }
    let queue;
    try { queue=read(); } catch { host.querySelector('span').textContent='Não foi possível ler as alterações pendentes. Não limpe os dados do navegador.'; return; }
    host.hidden=!localStorage.ml_token || (!queue.length && !lastSaved);
    host.querySelector('span').textContent=queue.length ? (running ? 'Sincronizando em segundo plano…' : queue[0].blocked ? 'Alteração pendente: o servidor recusou o envio. Confira os dados ou entre novamente.' : `${queue.length} alteração(ões) guardada(s) neste aparelho. Sincronização automática pendente.`) : 'Alterações salvas no servidor.';
    host.querySelector('button').hidden=!queue.length;
    host.querySelector('button').disabled=!!running;
  }
  async function flush(retryBlocked=true) {
    if (running) { await running; if (!read().length) return; }
    const id=owner(), token=localStorage.ml_token;
    if (!id || !token || navigator.onLine===false) {render();return;}
    let committed=false;
    const work=locked(id, async()=>{
      while (owner()===id && localStorage.ml_token===token) {
        const queue=read(id), entry=queue[0];
        if (!entry || (entry.blocked && !retryBlocked)) break;
        const result=await API.call(entry.action,entry.data);
        if (owner()!==id || localStorage.ml_token!==token) break;
        const latest=read(id);
        if (!result?.ok && !(entry.action.startsWith('delete') && result?.error==='Registro não encontrado')) {
          if(latest[0]?.id===entry.id) { latest[0].blocked=!result?.offline; write(id,latest); }
          break;
        }
        write(id,latest.filter(item=>item.id!==entry.id)); lastSaved=true;committed=true;
      }
    });
    running=work;render();
    try { await work; } catch { /* Durable queue remains for retry. */ }
    finally { if(running===work)running=null;render();if(!read().length&&committed)window.dispatchEvent(new Event('metalife-data-saved')); }
  }
  async function save(action,data) {
    const id=owner();
    if (!id) return {ok:false,error:'Faça login novamente.'};
    const payload=JSON.parse(JSON.stringify(data));
    if(action.startsWith('save')) {
      if (!payload.item || !payload.item.id) return API.call(action,data);
    } else if(!payload.id) return API.call(action,data);
    const entry={id:crypto.randomUUID(),action,data:payload,blocked:false};
    try {await locked(id, () => {const queue=read(id);queue.push(entry);write(id,queue);});}
    catch {return {ok:false,error:'Não foi possível guardar a alteração neste navegador. Verifique o espaço disponível.'};}
    render();
    /* Offline-first: a tela não espera Google Sheets concluir a gravação. */
    Promise.resolve().then(()=>flush(false)).catch(()=>{});
    return {ok:true,pending:true};
  }
  window.addEventListener('online',()=>flush(false));
  window.addEventListener('storage',render);
  setInterval(() => {
    if (!document.hidden && localStorage.ml_token && navigator.onLine !== false) flush(false);
  }, 30000);
  return {supports:action=>supported.test(action),save,flush,render,hasPending:()=>read().length>0};
})();
