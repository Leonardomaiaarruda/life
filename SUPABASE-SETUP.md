# MetaLife + Supabase

O repositório está preparado para uma migração gradual do Google Apps Script/Sheets para Supabase sem desligar o backend atual de uma vez.

## Estrutura oficial no repositório

- `supabase/config.toml`: configuração do projeto para Supabase CLI/GitHub integration.
- `supabase/migrations/20260914080000_initial_metalife_schema.sql`: migration inicial do banco.
- `js/supabase-adapter.js`: cliente opcional do Supabase, autenticação e snapshot de migração.
- `js/config.js`: contém os campos públicos do Supabase, mas permanece com `SUPABASE_ENABLED: false` até a conexão ser concluída.
- O Apps Script continua sendo o backend principal até a migração ser validada.

A fonte de verdade do banco agora é a pasta `supabase/migrations/`. Não use mais um `schema.sql` solto para alterações futuras. Cada mudança de banco deve virar uma nova migration versionada.

## 1. Criar o projeto Supabase

Crie um projeto no Supabase e escolha uma região adequada para os usuários do MetaLife.

No painel do projeto, copie apenas:

- Project URL
- Publishable key (ou chave pública equivalente)

**Nunca coloque `service_role`, secret key ou senha do banco no GitHub Pages.** O frontend é público.

## 2. Conectar o repositório GitHub

Conecte o repositório:

`Leonardomaiaarruda/life`

Use a branch principal:

`main`

A integração deve considerar a pasta padrão:

`supabase/`

Quando novas migrations forem adicionadas em `supabase/migrations/`, elas poderão fazer parte do fluxo de deploy/versionamento do banco conforme a integração escolhida no Supabase.

## 3. Aplicar a migration inicial

A migration inicial está em:

`supabase/migrations/20260914080000_initial_metalife_schema.sql`

Ela cria as tabelas iniciais, índices, trigger de perfil e políticas RLS por usuário.

Se a integração GitHub do seu projeto aplicar migrations automaticamente, use esse fluxo. Caso contrário, aplique a migration com Supabase CLI ou pelo fluxo de banco do próprio painel.

## 4. Configurar o frontend

No arquivo `js/config.js`, preencha:

```js
SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
SUPABASE_PUBLISHABLE_KEY: "SUA_CHAVE_PUBLICA",
SUPABASE_ENABLED: true,
DATA_PROVIDER: "hybrid"
```

Durante a primeira fase use `DATA_PROVIDER: "hybrid"`. O Apps Script continua atendendo o sistema enquanto validamos o Supabase.

## 5. Primeiro teste

Depois de configurar, abra o console do navegador e execute:

```js
await MetaLifeSupabase.status()
```

A resposta deve mostrar `configured: true` e `connected: true`.

Para criar uma conta de teste diretamente no Supabase:

```js
await MetaLifeSupabase.signUp("email@teste.com", "senha-forte", "Nome Teste")
```

Depois do login:

```js
await MetaLifeSupabase.testDatabase()
```

Se retornar `{ ok: true }`, autenticação + RLS + banco estão funcionando.

## 6. Teste da ponte de dados

Com um usuário Supabase autenticado:

```js
await MetaLifeSupabase.saveSnapshot(Store.load())
```

E para ler:

```js
await MetaLifeSupabase.loadSnapshot()
```

Essa etapa serve para validar a migração sem alterar ainda a estrutura interna do MetaLife.

## Ordem recomendada de migração

1. Auth + profiles
2. Metas, Meu Dia, hábitos, peso e tarefas
3. Treinos + séries + histórico de progressão
4. Dieta
5. Desafios e recompensas
6. Pessoas, amizades e perfis sociais
7. Conversas, mensagens e Realtime
8. Fotos/arquivos para Supabase Storage
9. Desativar Apps Script/Sheets somente depois de comparar os dados e validar todos os módulos

## Estratégia de segurança

O navegador deve conter somente a URL do projeto e chave pública. A segurança real vem das políticas RLS. Qualquer operação administrativa futura deve rodar em ambiente de servidor/Edge Function, nunca usando credenciais administrativas no GitHub Pages.

## Antes de migrar usuários existentes

As senhas atuais do MetaLife foram criadas fora do Supabase Auth. Não devemos copiar hashes diretamente para o Supabase. A migração de contas existentes deve ser feita com uma estratégia separada, por exemplo confirmação de e-mail ou redefinição de senha, para que o Supabase passe a administrar as credenciais corretamente.
