/* MetaLife V19 — funções auxiliares para multidispositivo, segurança e admin.
   Requer DB_ID, db(), sh(), hash(), uid(), now(), normalizeEmail(), userRow().
   Também requer pequenos encaixes no Code.gs principal descritos em ATIVAR-V19.md. */

function setupV19() {
  const book = db();
  const sessions = sh("SESSOES");
  const wanted = ["token","user_id","expira_em","criado_em","device_id","device_name","last_seen"];
  wanted.forEach((name,index)=>sessions.getRange(1,index+1).setValue(name));
  if (!book.getSheetByName("V19_AUDIT")) book.insertSheet("V19_AUDIT").appendRow(["id","user_id","evento","detalhes_json","criado_em"]);
  SpreadsheetApp.flush();
  return {ok:true,message:"MetaLife V19 ativado."};
}

function v19SessionSheet_(){ const s=sh("SESSOES"); if(s.getLastColumn()<7) setupV19(); return s; }

function v19Audit_(userId,event,details){
  try {
    let s=db().getSheetByName("V19_AUDIT");
    if(!s){setupV19();s=db().getSheetByName("V19_AUDIT");}
    s.appendRow([uid(),String(userId||""),String(event||""),JSON.stringify(details||{}),now()]);
  } catch(_) {}
}

function v19LoginKey_(email){ return "v19-login:"+hash(normalizeEmail(email)); }
function v19LoginGuard_(email){ const c=CacheService.getScriptCache(),n=Number(c.get(v19LoginKey_(email))||0); if(n>=8)throw new Error("Muitas tentativas de login. Aguarde alguns minutos e tente novamente."); }
function v19LoginFail_(email){ const c=CacheService.getScriptCache(),key=v19LoginKey_(email),n=Number(c.get(key)||0)+1;c.put(key,String(n),600); }
function v19LoginSuccess_(email){ CacheService.getScriptCache().remove(v19LoginKey_(email)); }

function v19RegisterDeviceSession_(token,userId,q){
  const sheet=v19SessionSheet_(),rows=sheet.getDataRange().getValues();
  const i=rows.findIndex((r,index)=>index>0&&String(r[0])===String(token)&&String(r[1])===String(userId));
  if(i<1)return;
  sheet.getRange(i+1,5,1,3).setValues([[String(q.device_id||"").slice(0,100),String(q.device_name||"").slice(0,120),now()]]);
}

function v19RegisterDevice(q){v19RegisterDeviceSession_(q.token,q.user_id,q);return{ok:true};}
function v19SyncHeartbeat(q){v19RegisterDeviceSession_(q.token,q.user_id,q);return{ok:true,server_time:now()};}

function v19ListSessions(q){
  const rows=v19SessionSheet_().getDataRange().getValues(),me=String(q.user_id),current=String(q.token);
  return {ok:true,items:rows.slice(1).filter(r=>String(r[1])===me&&new Date(r[2])>new Date()).map(r=>({id:hash(String(r[0])).slice(0,16),current:String(r[0])===current,expires_at:r[2],created_at:r[3],device_id:String(r[4]||""),device_name:String(r[5]||"Dispositivo"),last_seen:r[6]||r[3]}))};
}

function v19RevokeSession(q){
  const sheet=v19SessionSheet_(),rows=sheet.getDataRange().getValues(),me=String(q.user_id),target=String(q.session_id||"");
  for(let i=rows.length-1;i>0;i--){
    if(String(rows[i][1])===me&&hash(String(rows[i][0])).slice(0,16)===target){
      if(String(rows[i][0])===String(q.token))throw Error("Use Sair neste aparelho para encerrar a sessão atual.");
      CacheService.getScriptCache().remove("session:"+hash(String(rows[i][0])));
      sheet.deleteRow(i+1);v19Audit_(me,"session_revoked",{session_id:target});return{ok:true};
    }
  }
  return{ok:true};
}

function v19LogoutAllSessions(q){
  const sheet=v19SessionSheet_(),rows=sheet.getDataRange().getValues(),me=String(q.user_id),cache=CacheService.getScriptCache();let count=0;
  for(let i=rows.length-1;i>0;i--){if(String(rows[i][1])===me){cache.remove("session:"+hash(String(rows[i][0])));sheet.deleteRow(i+1);count++;}}
  SpreadsheetApp.flush();v19Audit_(me,"logout_all",{count});return{ok:true,count};
}

function v19RequireAdmin_(userId){const u=userRow(userId);if(!u||String(u[4]).toLowerCase()!=="admin")throw Error("Acesso restrito ao administrador.");return u;}

function v19AdminDashboard(q){
  v19RequireAdmin_(q.user_id);
  const users=sh("USUARIOS").getDataRange().getValues().slice(1),sessions=v19SessionSheet_().getDataRange().getValues().slice(1),nowDate=new Date(),seven=new Date(Date.now()-7*86400000),thirty=new Date(Date.now()-30*86400000);
  const audit=db().getSheetByName("V19_AUDIT");
  return{ok:true,users_total:users.length,users_active:users.filter(r=>String(r[5])==="ativo").length,new_7d:users.filter(r=>new Date(r[10])>=seven).length,new_30d:users.filter(r=>new Date(r[10])>=thirty).length,active_sessions:sessions.filter(r=>new Date(r[2])>nowDate).length,audit_events:audit?Math.max(0,audit.getLastRow()-1):0};
}

function v19AdminUsers(q){
  v19RequireAdmin_(q.user_id);
  return{ok:true,items:sh("USUARIOS").getDataRange().getValues().slice(1).slice(-200).reverse().map(r=>({id:String(r[0]),name:String(r[1]),email:String(r[2]),role:String(r[4]),status:String(r[5]),created_at:r[10],updated_at:r[11]}))};
}
