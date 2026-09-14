# Ativar estado multidispositivo do V22

O arquivo `V22State.gs` já contém as funções `v22GetState` e `v22SaveState`.

No `Code.gs` principal, dentro de `privateActions`, inclua:

```javascript
v22GetState,
v22SaveState,
```

Depois publique uma nova versão da implantação Web App do Apps Script.

Não é necessário criar uma aba nova: o estado usa `saveUserData` / `listUserData` e fica na própria aba `USR_XXXXXXXX` do usuário com tipo `v22_state` e id `V22_STATE`.

O frontend `js/challenges-account-sync.js` detecta automaticamente se essas ações estão disponíveis. Enquanto o backend antigo responder `Ação inválida`, ele preserva os dados locais e não tenta apagar nem substituir desafios existentes.
