function v22GetState(q) {
  var rows = listUserData(q.user_id, 'v22_state');
  var item = null;
  for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === 'V22_STATE') item = rows[i];
  return {ok:true, item:item};
}

function v22SaveState(q) {
  var source = q.state || {};
  var item = {
    id:'V22_STATE',
    challenges:Array.isArray(source.challenges) ? source.challenges : [],
    rewards:Array.isArray(source.rewards) ? source.rewards : [],
    coins:Array.isArray(source.coins) ? source.coins : [],
    client_updated_at:String(q.client_updated_at || ''),
    updatedAt:now()
  };
  return saveUserData(q.user_id, 'v22_state', item);
}
