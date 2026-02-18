# Capability Tests

Testes de capacidade verificam se o agente **probe** consegue usar todos os recursos que o Backbone entrega para ele.

O Backbone monta o contexto do agente (skills, tools, adapters, memória, cron, etc.) e o probe precisa demonstrar que consegue operar cada um deles. A pasta `hooks/` e `PROMPT-BASE.md` entregam ao probe os textos e recursos necessários para cada teste.

## Modos de teste

### Conversational

Envia mensagens para o probe via **API de conversação** e verifica nas respostas se ele conseguiu usar o recurso testado. É um bate-papo: pergunta, resposta, validação.

### Heartbeat

Ativa o probe e **observa o canal probe** via SSE. O agente executa seu ciclo autônomo e emite relatórios no canal. Os relatórios contêm a informação necessária para determinar se o recurso funciona.

## Princípio

Não existe outra forma de testar a não ser:
1. Usar a API de conversação (chat)
2. Observar o canal probe (heartbeat)

O teste roda o agente, coleta os dados e grava o relatório. **Não diagnostica, não corrige, não retenta.** Apenas reporta: usou ou não usou.

## Inventário de recursos

`RESOURCES.md` mantém o mapeamento completo de tudo que o Backbone disponibiliza para o agente — skills, tools, adapters, memória, cron, hooks, etc. — e qual teste cobre cada item.

## Resultados

Cada teste grava seus resultados em:

```
agentic-backbone/test-results/capabilities/{test-slug}/
├── RESULTS.md       # Relatório (PASS/FAIL/SKIP)
└── *.log / *.json   # Evidências (respostas SSE, payloads, etc.)
```

## Uso

```bash
# Um teste individual
bash agentic-backbone/tests/capabilities/test-conv-1

# Todos os testes
bash agentic-backbone/tests/capabilities/test-all
```
