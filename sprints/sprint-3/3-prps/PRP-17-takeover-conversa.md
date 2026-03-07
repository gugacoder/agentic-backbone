# PRP-17 — Takeover de Conversa

Operador humano assume conversa do agente em tempo real, com pausa automatica do agente e retomada apos finalizacao.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem chat funcional (PRP-04) com streaming, historico e gerenciamento de sessoes. Porem, se o agente nao sabe responder ou responde inadequadamente, o operador nao tem como intervir — a unica opcao eh desligar o agente inteiro (toggle enabled), afetando todas as conversas. Nao ha mecanismo de takeover por sessao.

### Estado desejado

1. Colunas `takeover_by` e `takeover_at` na tabela `sessions`
2. Endpoints `POST /conversations/:sessionId/takeover` e `POST /conversations/:sessionId/release`
3. Backend bloqueia agente durante takeover (nao aciona `runAgent()`)
4. Operador envia mensagens no lugar do agente durante takeover
5. UI: botao "Assumir conversa", banner de takeover, botao "Devolver ao agente"
6. Mensagens do operador com visual distinto (badge, cor, icone)
7. Evento SSE `session:takeover` para atualizacao real-time
8. Badge de takeover ativo na lista de sessoes

## Especificacao

### Feature F-067: Schema takeover + logica backend

**Alteracao na tabela `sessions`:**

```sql
ALTER TABLE sessions ADD COLUMN takeover_by TEXT;
ALTER TABLE sessions ADD COLUMN takeover_at TEXT;
```

**Logica no backend:**

- Quando `takeover_by` nao eh null, `sendMessage()` verifica antes de acionar `runAgent()` — se preenchido, nao aciona
- Mensagens do operador durante takeover salvas com role distinto (ex: `assistant` com metadata `{ operator: true, operatorSlug: "admin" }`) para distinguir no frontend
- Mensagens de usuarios externos durante takeover salvas normalmente (operador vera e respondera)

### Feature F-068: Endpoints takeover/release + adaptacao messages

**Novos endpoints:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/conversations/:sessionId/takeover` | Iniciar takeover |
| POST | `/conversations/:sessionId/release` | Devolver ao agente |

**POST `/conversations/:sessionId/takeover`:**

Payload: nenhum (usuario extraido do JWT). Seta `takeover_by` e `takeover_at`. Gera notificacao `takeover_started` (info). Emite evento SSE `session:takeover`.

**Response:**

```json
{
  "sessionId": "abc123",
  "takenOverBy": "admin",
  "takenOverAt": "2026-03-07T14:00:00Z"
}
```

**POST `/conversations/:sessionId/release`:**

Limpa `takeover_by` e `takeover_at`. Gera notificacao `takeover_ended` (info). Emite evento SSE `session:takeover`.

**Response:**

```json
{
  "sessionId": "abc123",
  "released": true
}
```

**Adaptacao de `POST /conversations/:sessionId/messages`:**

- Se `takeover_by` preenchido e remetente eh o operador: salvar mensagem com role adequado, **nao acionar agente**, retornar sucesso
- Se `takeover_by` nao preenchido: comportamento normal

**Evento SSE:**

```
event: session:takeover
data: {"sessionId": "abc123", "takenOverBy": "admin", "action": "takeover"}
```

### Feature F-069: UI de takeover (banner, botoes, mensagens operador)

**components/conversations/takeover-button.tsx:**

```typescript
interface TakeoverButtonProps {
  sessionId: string;
  onTakeover: () => void;
}
```

- Visivel na tela de chat quando `takeover_by` eh null
- Icone UserCheck + texto "Assumir conversa"
- Dialog de confirmacao: "O agente parara de responder. Deseja continuar?"

**components/conversations/takeover-banner.tsx:**

```typescript
interface TakeoverBannerProps {
  takenOverBy: string;
  takenOverAt: string;
  onRelease: () => void;
}
```

- Banner no topo da conversa indicando quem assumiu, ha quanto tempo
- Botao "Devolver ao agente" (icone Bot) com confirmacao

**components/conversations/operator-message.tsx:**

- Mensagens do operador com badge visual distinto do agente
- Icone User para operador, Bot para agente
- Cor diferente (operador usa `--primary`, agente usa `--muted`)

**Input de mensagem** durante takeover: funciona normalmente (operador digita e envia sem acionar agente).

### Feature F-070: Indicadores na lista de sessoes + SSE

**Na lista de sessoes (`/conversations`):**

- Badge "Operador" ou icone especifico em sessoes com takeover ativo
- Filtro opcional: "Conversas com operador"

**SSE integration:**

- Evento `session:takeover` invalida queries `["conversations"]` e `["conversations", sessionId]`
- Atualiza estado de takeover em real-time

## Limites

- **NAO** implementar fila de atendimento humano — takeover eh manual, por iniciativa do operador.
- **NAO** implementar transferencia entre operadores — apenas um operador por sessao.
- **NAO** implementar auto-takeover (agente pede ajuda) — apenas manual.
- **NAO** implementar historico de takeovers por sessao — apenas estado atual.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-04** (Chat e Conversas) deve estar implementado — takeover vive na tela de chat.

## Validacao

- [ ] Botao "Assumir conversa" visivel em sessoes ativas
- [ ] Click em "Assumir" pausa o agente e habilita input do operador
- [ ] Mensagens do operador salvas no historico com identificacao visual
- [ ] Agente nao responde durante takeover (verificacao no backend)
- [ ] Botao "Devolver ao agente" restaura operacao normal
- [ ] Banner de takeover visivel com info do operador e duracao
- [ ] Evento SSE `session:takeover` emitido e tratado no frontend
- [ ] Lista de sessoes indica takeover ativo com badge
- [ ] Confirmacao antes de assumir e antes de devolver
- [ ] Mensagens de usuarios externos durante takeover salvas normalmente
- [ ] Notificacoes geradas ao iniciar/encerrar takeover
- [ ] `npm run build:hub` compila sem erros (backbone e hub)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-067 Schema + logica backend | S-017 sec 2-3 | D-028, G-028 |
| F-068 Endpoints takeover/release | S-017 sec 4 | D-028, G-028 |
| F-069 UI takeover (banner, botoes) | S-017 sec 5.1-5.5 | G-028, D-004 |
| F-070 Indicadores lista + SSE | S-017 sec 5.6, 3.3 | G-028, D-001 |
