/* The panel uses confirmed server totals, never the legacy +100 client increment. */
window.UnifiedXP=(()=>{
  let timer=null,running=false,dirty=false;
  function apply(result){
    if(!result?.ok||!Number.isFinite(result.xp))return;
    state.unifiedProgress={...result,owner:String(localStorage.ml_user_id||''),synced_at:new Date().toISOString()};
    if(state.user){state.user.xp=result.xp;state.user.level=result.level;state.user.streak=result.streak;}
    Store.save(state);paint();
  }
  function current(){return state.unifiedProgress?.owner===String(localStorage.ml_user_id||'')?state.unifiedProgress:null;}
  function value(key){const p=current();return p?p[key]:'—';}
  function paint(){document.querySelectorAll('[data-unified-xp]').forEach(el=>el.textContent=value('xp'));document.querySelectorAll('[data-unified-level]').forEach(el=>el.textContent=value('level'));document.querySelectorAll('[data-unified-streak]').forEach(el=>el.textContent=value('streak'));document.querySelectorAll('[data-unified-status]').forEach(el=>el.textContent=window.Sync?.hasPending()?'XP confirmado antes dos envios pendentes':current()?'XP integrado · sincronizado':'Aguardando sincronização do XP');}
  async function refresh(){
    if(!localStorage.ml_token||document.hidden)return;
    if(running){dirty=true;return;}if(window.Sync?.hasPending()){paint();return;}
    running=true;dirty=false;const token=localStorage.ml_token;
    try{const result=await API.call('getUnifiedProgress');if(token===localStorage.ml_token&&!dirty&&!window.Sync?.hasPending())apply(result);}
    finally{running=false;if(dirty)schedule();}
  }
  function schedule(){dirty=true;clearTimeout(timer);timer=setTimeout(refresh,700);}
  window.addEventListener('metalife-data-saved',schedule);
  window.addEventListener('online',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  return {apply,paint,value,refresh,schedule};
})();
