# Heartbeat Instructions

Seu ciclo tem três fases: **submeter**, **coletar** e **notificar**.

Você tem acesso às tools `submit_job`, `list_jobs`, `get_job` e `kill_job` para gerenciar processos longos.
O caminho do script de classificação é `<agent_dir>/tasks/classificar/classificar.mjs` (use o valor de agent_dir do `<agent_context>`).

## Verificar se já classificou hoje

Antes de qualquer coisa, consulte o banco via adapter cia-app:

```bash
bash <connector_dir>/query.sh <cia-app_dir> "SELECT MAX(last_calculated_at) AS last_run FROM guardian_expectations WHERE tenant_id = 1"
```

Se `last_run` é de hoje → já classificou. Não submeta de novo.

## Fase 1 — Submeter classificação

Se ainda não classificou hoje e é após 05:00:

1. Use `list_jobs` para verificar se já tem um job rodando.
2. Se há job `running` → HEARTBEAT_OK (esperando).
3. Se não há job rodando, use `submit_job` com:
   - command: `node <agent_dir>/tasks/classificar/classificar.mjs`
   - timeout: 300
4. Responda HEARTBEAT_OK e durma. O backbone te acorda quando o job terminar.

## Fase 2 — Coletar resultado

Quando acordar e houver um job `completed` ou `failed`:

1. Use `get_job` com o jobId para ver o resultado.
2. Se `completed`: leia o campo `tail` — contém o JSON com classificações, mudanças de faixa e resumo.
3. Se `failed` ou `timeout`: registre o erro. Resubmeta no próximo ciclo se faz sentido.

## Fase 3 — Notificar mudanças de faixa

Se o resultado da classificação contiver `band_changes` com pelo menos uma entrada:

1. Para cada mudança de faixa que tenha `celular` preenchido, envie uma mensagem via WhatsApp.
2. Use o adapter **evolution** via Bash:

```bash
bash <connector_dir>/send.sh <evolution_dir> "/message/sendText/<instance_name>" '{"number":"<celular>","text":"<mensagem>"}'
```

3. Leia o `instance_name` do ADAPTER.yaml do evolution.
4. Compose a mensagem com tom profissional e empático. Exemplos:

   - **Melhoria** (yellow→green): "Parabéns [nome]! Seu desempenho no registro de ponto melhorou. Continue assim!"
   - **Piora** (green→yellow): "[nome], notamos que alguns registros de ponto ficaram pendentes. Precisando de ajuda, conte conosco."
   - **Piora grave** (→red): "[nome], seus registros de ponto precisam de atenção urgente. Procure seu supervisor para suporte."

5. **Se o envio falhar** (Evolution offline, timeout, erro de rede): **apenas logue o erro e continue**. Nunca interrompa o heartbeat por falha de notificação.

## Decisão a cada heartbeat

```
1. Consultar banco — já classificou hoje?
2. Se sim → list_jobs para ver se há algo pendente
3. Se há job running → HEARTBEAT_OK
4. Se há job completed/failed → coletar resultado (Fase 2) e notificar (Fase 3)
5. Se não classificou hoje e é após 05:00 → submeter (Fase 1)
6. Se nada pendente → HEARTBEAT_OK
```

## Importante

- Não rode `node classificar.mjs` direto no Bash — use `submit_job` para processos que demoram.
- O campo `tail` do job contém os últimos 2000 caracteres do output.
- Se o Evolution estiver fora do ar, **não crashe**. Logue e siga em frente.
- Envie mensagens apenas para guardiões que tiveram **mudança de faixa** — não notifique quem permaneceu na mesma categoria.
