# Snapshot canônico do backend MetaLife V20

Build de referência: `2026.09.10-v20-block3-backend-complete-1`

Arquivos do pacote completo preservado fora do runtime do frontend:

- `Code.gs` — SHA-256 `1d303b9b401ef29fbcb3c2e9b5713e7174cb80f1628bf8b89510cadd20d2de4d`
- `Push.gs` — SHA-256 `2f37dda29d81438703b568bc197e67af72608817222f61f820ab08b6dd665ef6`
- `PushCrypto.gs` — SHA-256 `348ff71d5bc0b26023269fe7b11111567d31cb23bdda603335491c9958bf2c33`
- `LEIA-ME.txt` — SHA-256 `036012c28f6288b545c67872e22da42d241a214bce3eacb453cd71f0cd93ad18`

O pacote V20 contém autenticação, sessão, dados pessoais, social, chat, desafios legados, notificações push, V19 e perfil/planejamento de treino V20. Chaves privadas de Push permanecem em Script Properties e não fazem parte do código versionado.

A partir da V22.2, extensões novas devem ficar em arquivos `.gs` separados em `apps-script/` quando possível, evitando editar funcionalidades antigas sem necessidade.
