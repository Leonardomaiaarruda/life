# Ativar MetaLife V20 no Google Apps Script

O frontend do Bloco 3 já funciona localmente. Para sincronizar perfil e plano do Treino Inteligente entre celular e computador, adicione o arquivo `apps-script/V20.gs` ao mesmo projeto Apps Script do MetaLife.

## 1. Adicione as novas rotas no roteador autenticado

No ponto do `Code.gs` principal em que `q.user_id` já foi validado pela sessão, encaminhe:

```javascript
if (q.action === 'v20GetTrainingProfile') return v20GetTrainingProfile(q);
if (q.action === 'v20SaveTrainingProfile') return v20SaveTrainingProfile(q);
```

Essas rotas devem ficar depois da autenticação; não exponha `user_id` vindo do navegador sem validar o token.

## 2. Execute uma vez

No editor do Apps Script, execute:

```javascript
setupV20()
```

Isso cria a aba `V20_TRAINING` com uma linha por usuário e controle de versão.

## 3. Reimplante o Web App

Crie uma nova versão/implantação do Web App mantendo a mesma URL usada pelo frontend, quando possível.

## Como a sincronização funciona

- cada plano possui `updatedAt` e identificação do aparelho;
- o servidor mantém um número de versão;
- o cliente envia `expected_version` para evitar sobrescrever silenciosamente alterações de outro aparelho;
- em conflito, o MetaLife mostra opções para usar a versão do servidor ou manter a versão local;
- sem internet ou sem backend V20 publicado, o plano continua funcionando localmente.
