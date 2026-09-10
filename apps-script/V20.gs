/* MetaLife V20 — backend auxiliar para Treino Inteligente multidispositivo.
   Requer as funções globais do backend principal: db(), sh(), uid(), now().
   O roteador do Code.gs principal deve encaminhar as ações v20GetTrainingProfile
   e v20SaveTrainingProfile para as funções abaixo após autenticar a sessão e preencher q.user_id. */

function setupV20() {
  const book = db();
  let sheet = book.getSheetByName('V20_TRAINING');
  if (!sheet) sheet = book.insertSheet('V20_TRAINING');
  const headers = ['user_id','version','profile_json','plan_json','device_id','client_updated_at','updated_at'];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
  return {ok:true,message:'MetaLife V20 multidispositivo ativado.'};
}

function v20Sheet_() {
  let s = db().getSheetByName('V20_TRAINING');
  if (!s) { setupV20(); s = db().getSheetByName('V20_TRAINING'); }
  return s;
}

function v20FindRow_(userId) {
  const sheet = v20Sheet_();
  const last = sheet.getLastRow();
  if (last < 2) return {sheet:sheet,row:0,values:null};
  const rows = sheet.getRange(2,1,last-1,7).getValues();
  for (let i=0;i<rows.length;i++) if (String(rows[i][0]) === String(userId)) return {sheet:sheet,row:i+2,values:rows[i]};
  return {sheet:sheet,row:0,values:null};
}

function v20Parse_(value,fallback) {
  try { return value ? JSON.parse(String(value)) : fallback; } catch (_) { return fallback; }
}

function v20GetTrainingProfile(q) {
  const found = v20FindRow_(q.user_id);
  if (!found.row) return {ok:true,exists:false,version:0,profile:null,plan:null};
  const r = found.values;
  return {
    ok:true,
    exists:true,
    version:Number(r[1]||0),
    profile:v20Parse_(r[2],null),
    plan:v20Parse_(r[3],null),
    device_id:String(r[4]||''),
    client_updated_at:r[5]||'',
    updated_at:r[6]||''
  };
}

function v20SaveTrainingProfile(q) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const found = v20FindRow_(q.user_id);
    const currentVersion = found.row ? Number(found.values[1]||0) : 0;
    const expected = Number(q.expected_version||0);
    const force = q.force === true || String(q.force).toLowerCase() === 'true';
    if (!force && expected !== currentVersion) {
      const current = found.row ? v20GetTrainingProfile(q) : {ok:true,exists:false,version:0,profile:null,plan:null};
      current.conflict = true;
      return current;
    }

    const nextVersion = currentVersion + 1;
    const row = [
      String(q.user_id||''),
      nextVersion,
      JSON.stringify(q.profile||null),
      JSON.stringify(q.plan||null),
      String(q.device_id||'').slice(0,100),
      String(q.client_updated_at||'').slice(0,60),
      now()
    ];
    if (found.row) found.sheet.getRange(found.row,1,1,7).setValues([row]);
    else found.sheet.appendRow(row);
    SpreadsheetApp.flush();
    return {ok:true,version:nextVersion,updated_at:row[6]};
  } finally {
    lock.releaseLock();
  }
}
