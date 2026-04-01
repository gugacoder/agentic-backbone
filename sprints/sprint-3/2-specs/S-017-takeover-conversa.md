# AB Hub - Takeover de Conversa

Operador humano assume conversa do agente em tempo real, com pausa automatica do agente e retomada apos finalizacao.

---

## 1. Objetivo

- Permitir que operador assuma conversa em andamento no lugar do agente
- Agente para de responder automaticamente durante takeover
- Agente retoma quando operador finaliza o takeover
- Notificacao ao operador quando agente nao sabe responder (opcional)
- Resolver D-028 (sem takeover), G-028 (operador assume do agente)

---

## 2. Schema DB

### 2.1 Alteracao na Tabela `sessions`

Adicionar coluna para controle de takeover:

```sql
ALTER TABLE sessions ADD COLUMN takeover_by TEXT;          -- user slug do operador (null = agente no controle)
ALTER TABLE sessions ADD COLUMN takeover_at TEXT;          -- timestamp do takeover
```

Quando `takeover_by` nao eh null, o agente nao responde a mensagens nessa sessao.

---

## 3. Backend: Logica de Takeover

### 3.1 Fluxo de Takeover

1. Operador clica "Assumir conversa" no Hub
2. `POST /conversations/:sessionId/takeover` — seta `takeover_by` e `takeover_at`
3. Mensagens do operador sao enviadas normalmente via `POST /conversations/:sessionId/messages` mas com flag `sender: "human"` ao inves de acionar o agente
4. Agente eh bloqueado: `sendMessage()` verifica `takeover_by` antes de acionar `runAgent()` — se preenchido, nao aciona
5. Operador clica "Devolver ao agente"
6. `POST /conversations/:sessionId/release` — limpa `takeover_by` e `takeover_at`
7. Agente volta a responder normalmente

### 3.2 Mensagens do Operador

Durante takeover, mensagens enviadas pelo operador sao salvas no historico da sessao com role `operator` (ou `assistant` com metadata indicando humano), permitindo distinguir no frontend.

### 3.3 Evento SSE

Emitir evento quando takeover inicia/termina:

```
event: session:takeover
data: {"sessionId": "abc123", "takenOverBy": "admin", "action": "takeover"}

event: session:takeover
data: {"sessionId": "abc123", "action": "release"}
```

---

## 4. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/conversations/:sessionId/takeover` | Iniciar takeover |
| POST | `/conversations/:sessionId/release` | Devolver ao agente |
| POST | `/conversations/:sessionId/messages` | Enviar mensagem (existente — adaptar) |

### 4.1 POST `/conversations/:sessionId/takeover`

**Payload:** nenhum (usuario extraido do JWT)

**Response:**

```json
{
  "sessionId": "abc123",
  "takenOverBy": "admin",
  "takenOverAt": "2026-03-07T14:00:00Z"
}
```

Gera notificacao `takeover_started` (info) para registro.

### 4.2 POST `/conversations/:sessionId/release`

**Response:**

```json
{
  "sessionId": "abc123",
  "released": true
}
```

Gera notificacao `takeover_ended` (info).

### 4.3 POST `/conversations/:sessionId/messages` (adaptacao)

Adaptar o endpoint existente:

- Se `takeover_by` esta preenchido e o remetente eh o operador: salvar mensagem com role adequado, **nao acionar agente**, retornar sucesso
- Se `takeover_by` nao esta preenchido: comportamento normal (aciona agente)
- Se usuario envia mensagem durante takeover: salvar normalmente (operador vera e respondera)

---

## 5. Telas

### 5.1 Indicador de Takeover no Chat

Na tela de chat existente (`/conversations/:id`), quando a sessao tem `takeover_by`:

```
+---------- Chat Session -------------------+
| [Agente: system.main]  [TAKEOVER ATIVO]  |
| Operador: admin | Desde: 14:00           |
|                                          |
| [mensagens normais do historico]         |
|                                          |
| [!] Operador admin assumiu a conversa    |
|                                          |
| [mensagens do operador com badge]        |
|                                          |
| +--------------------------------------+ |
| | [input de mensagem]  [Enviar]        | |
| +--------------------------------------+ |
| [Devolver ao agente]                     |
+------------------------------------------+
```

### 5.2 Botao "Assumir Conversa"

- Visivel na tela de chat quando `takeover_by` eh null
- Botao com icone UserCheck e texto "Assumir conversa"
- Confirmacao antes de assumir ("O agente parara de responder. Deseja continuar?")

### 5.3 Botao "Devolver ao Agente"

- Visivel apenas durante takeover (quando operador esta no controle)
- Botao com icone Bot e texto "Devolver ao agente"
- Confirmacao antes de devolver

### 5.4 Mensagens do Operador

- Badge visual distinto para mensagens do operador vs agente
- Icone User para operador, Bot para agente
- Cor diferente (operador usa cor `--primary`, agente usa `--muted`)

### 5.5 Banner de Takeover

Banner no topo da conversa indicando:
- Quem assumiu
- Ha quanto tempo
- Botao de acao (devolver)

### 5.6 Lista de Conversas

Na lista de sessoes, indicar visualmente sessoes com takeover ativo:
- Badge "Operador" ou icone especifico
- Filtro: "Conversas com operador"

---

## 6. Componentes

### 6.1 TakeoverBanner

**Localizacao:** `components/conversations/takeover-banner.tsx`

```typescript
interface TakeoverBannerProps {
  takenOverBy: string;
  takenOverAt: string;
  onRelease: () => void;
}
```

### 6.2 TakeoverButton

**Localizacao:** `components/conversations/takeover-button.tsx`

```typescript
interface TakeoverButtonProps {
  sessionId: string;
  onTakeover: () => void;
}
```

- Inclui dialog de confirmacao

### 6.3 OperatorMessage

**Localizacao:** `components/conversations/operator-message.tsx`

- Renderiza mensagem com visual distinto do agente

### 6.4 Adaptacoes nos componentes existentes

- `ChatInput` — funciona normalmente durante takeover (operador digita)
- `MessageList` — distingue mensagens de agente vs operador
- `SessionList` — badge de takeover ativo

---

## 7. Criterios de Aceite

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

---

## 8. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| Takeover flow (backend) | D-028 (sem takeover), G-028 (operador assume) |
| TakeoverBanner + Button | G-028 (botao assumir), D-028 (intervencao humana) |
| OperatorMessage | G-028 (operador responde), D-004 (governanca parcial) |
| SSE session:takeover | G-028 (tempo real), D-001 (visibilidade) |
