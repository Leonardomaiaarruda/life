# MetaLife V19 — ativação do backend

O frontend V19 já funciona para modo offline/local, calendário unificado, comparação de períodos e substituição de exercícios. Para liberar sessões por aparelho, encerramento remoto, proteção extra de login e painel administrativo, aplique os encaixes abaixo no projeto atual do Google Apps Script.

## 1. Adicione o arquivo `apps-script/V19.gs`

Crie um arquivo `V19` no mesmo projeto do Apps Script e cole nele o conteúdo de `apps-script/V19.gs`.

## 2. Adicione as ações ao `privateActions` do `doPost`

Inclua estas funções no objeto `privateActions`:

```js
v19RegisterDevice,
v19ListSessions,
v19RevokeSession,
v19LogoutAllSessions,
v19AdminDashboard,
v19AdminUsers,
v19SyncHeartbeat,
```

## 3. Registre o aparelho no login

Logo depois de criar/cachear a sessão no `login(q)`, adicione:

```js
v19RegisterDeviceSession_(token, String(user[0]), q || {});
v19Audit_(String(user[0]), "login", {
  device_id: q.device_id || "",
  device_name: q.device_name || ""
});
```

Inclua também `role` no objeto `user` retornado pelo login:

```js
role: String(user[4] || "usuario"),
```

## 4. Proteja tentativas de login

Depois de ler `email` e `password`, antes de consultar `USUARIOS`:

```js
v19LoginGuard_(email);
```

Quando o login falhar, antes de lançar o erro:

```js
v19LoginFail_(email);
```

Quando o login for aceito:

```js
v19LoginSuccess_(email);
```

## 5. Proteção multidispositivo em registros

No início de `saveUserDataUnlocked`, depois de definir `object.id`, adicione:

```js
const incomingUpdated = object.updatedAt || object.updated_at || now().toISOString();
object.updatedAt = incomingUpdated;
```

Ao localizar uma linha existente com o mesmo `type` e `id`, antes de sobrescrever, compare com a versão do servidor:

```js
try {
  const existingObject = JSON.parse(values[i][8] || "{}");
  const existingUpdated = existingObject.updatedAt || existingObject.updated_at || values[i][10] || values[i][9];
  if (existingUpdated && incomingUpdated && new Date(existingUpdated) > new Date(incomingUpdated)) {
    return {
      ok: false,
      conflict: true,
      id,
      server: existingObject,
      error: "Existe uma versão mais recente salva por outro aparelho."
    };
  }
} catch (_) {}
```

## 6. Execute `setupV19()` uma vez

Isso amplia a aba `SESSOES` com `device_id`, `device_name` e `last_seen` e cria a aba `V19_AUDIT`.

## 7. Administrador

Para liberar o painel administrativo para uma conta, altere manualmente a coluna `tipo` da aba `USUARIOS` para:

```text
admin
```

O painel valida isso no servidor; alterar qualquer valor no navegador não concede acesso.

## 8. Reimplante

Use **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**, preservando a URL atual do Web App.

A senha continua compatível com o hash já usado pelo projeto. A V19 acrescenta limitação temporária de tentativas, sessões por aparelho, encerramento remoto e auditoria de eventos; não converte automaticamente hashes antigos para outro algoritmo.
