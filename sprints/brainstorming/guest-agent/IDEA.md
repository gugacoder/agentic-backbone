# Ideacao — Guest Agent (Agente Convidado)

Permitir que o usuario invoque um agente diferente do responsavel pela sessao, para responder como convidado dentro da mesma conversa.

---

## Problema

Hoje uma conversa pertence a um agente. O `sessionId` esta vinculado a um `agentId` desde a criacao. Toda mensagem enviada nessa sessao eh processada pelo mesmo agente — mesma identidade, mesmo system prompt, mesmas tools.

Se o usuario precisa de outro agente (ex: um especialista diferente), precisa abrir outra conversa, perdendo contexto e historico.

## Conceito

O usuario esta numa conversa com o agente A (o dono). Ele seleciona o agente B no seletor e envia uma mensagem. O sistema:

1. Resolve a identidade do agente B (system prompt, tools, modelo)
2. Passa o mesmo `sessionId` e historico da conversa
3. Executa o `runAgent()` com os dados do agente B
4. A resposta do agente B aparece na thread, marcada como vinda dele (convidado)
5. A sessao continua pertencendo ao agente A

O agente B nao assume a sessao. Ele responde uma vez (ou enquanto estiver selecionado). O agente A continua sendo o dono.

## Analogia

Como um grupo de WhatsApp que pertence a um admin, mas outros participantes podem falar. O admin eh o agente dono; os convidados sao agentes que o usuario invoca sob demanda.

---

## Questoes em aberto

### Identidade na thread
- Como identificar visualmente que uma mensagem veio do agente B e nao do A?
- Badge no bubble? Cor diferente? Avatar?

### Contexto do convidado
- O agente B recebe o historico completo da conversa?
- Ou recebe apenas a mensagem do usuario + um resumo?
- Recebe o system prompt do agente A como contexto? Provavelmente nao — ele tem sua propria identidade.

### Tools
- O agente B usa suas proprias tools ou as do agente A?
- Se o agente B tem tools que o agente A nao tem (ex: acesso a outro banco), isso funciona naturalmente.
- Se o agente B nao tem tools que o agente A tem, o usuario perde capacidades temporariamente.

### Persistencia
- As mensagens do agente B sao salvas no mesmo `messages.jsonl` da sessao?
- Precisam de um campo extra (ex: `guestAgentId`) pra saber quem respondeu?
- O `SESSION.yml` precisa registrar quais agentes participaram?

### Backend
- O endpoint `POST /conversations/:id/messages` hoje resolve o agente pelo `agentId` da sessao. Precisaria aceitar um `agentId` override no body ou query.
- O `runAgent()` ja aceita agente como parametro — o desacoplamento ja existe nesse nivel.

### Seletor no ai-chat
- O conceito de `endpoints` que existe hoje no `<Chat>` (e que removemos da chamada) eh exatamente esse seletor.
- A diferenca: hoje `endpoints` era puramente visual. Aqui ele precisa influenciar o POST real.
- O `activeAgent` precisa ser enviado junto com a mensagem.

### Limites
- O convidado pode invocar heartbeat? Provavelmente nao — heartbeat eh do dono.
- O convidado tem acesso a memoria do dono? Provavelmente nao — cada agente tem seu proprio escopo de memoria.
- O convidado pode criar sub-sessoes ou delegar? Provavelmente nao na v1.

---

## Fluxo proposto (rascunho)

```
Usuario seleciona agente B no seletor
  |
  v
Usuario envia mensagem
  |
  v
ai-chat POST /conversations/:sessionId/messages
  body: { content, agentId: "agente-b" }   <-- novo campo
  |
  v
Backend detecta agentId != sessao.agentId
  |
  v
Resolve identidade do agente B (prompt, tools, modelo)
Executa runAgent() com agente B + historico da sessao
  |
  v
Resposta salva no messages.jsonl com metadata { guestAgentId: "agente-b" }
  |
  v
SSE stream para o cliente com identificacao do agente
  |
  v
ai-chat renderiza a resposta com indicacao visual do convidado
```

---

## Impacto nos modulos

| Modulo | Mudanca |
|---|---|
| `ai-chat` | Enviar `agentId` no POST quando diferente do dono. Exibir identidade do agente nas mensagens. |
| `routes/conversations` | Aceitar `agentId` opcional no body. Resolver agente convidado. |
| `agent/` | Nenhuma — `runAgent()` ja aceita agente como parametro. |
| `conversations/` | Salvar `guestAgentId` no JSONL. Retornar campo na leitura. |
| `agents/` | Nenhuma — registry ja resolve qualquer agente por ID. |

---

## Relacao com o seletor atual

Os props `endpoints`, `defaultAgent`, `showAgentSelector`, `compactAgentSelector` que existem no `<Chat>` foram pensados para essa direcao mas nunca conectados ao fluxo real. Eles sao a casca de UI que essa feature preencheria com funcionalidade.

Hoje estao removidos da chamada no hub. Quando esta feature for implementada, voltam — mas conectados ao POST de verdade.
