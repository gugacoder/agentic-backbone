# Business Model Canvas — KeepCoding

> **Objetivo:** R$50k/mês em 6 meses, operando em PT, ES e EN.
> **Produto-base:** Agentic Backbone + Agentic Workflow
> **Hipótese:** Recepcionista IA vertical para profissionais de serviço
> **Data:** 2026-03-21

---

## 1. Segmentos de Clientes

**Primário (mês 1-3):** Profissionais autônomos e microempresas de serviço que dependem de agendamento via WhatsApp — onde perder uma mensagem = perder receita.

| Vertical | Dor específica | Tamanho estimado |
|---|---|---|
| Clínicas/consultórios (fisio, psico, odonto, estética) | Paciente manda WhatsApp às 22h, ninguém responde, marca com outro | BR: ~1.5M profissionais de saúde autônomos |
| Escritórios (advocacia, contabilidade, arquitetura) | Recepcionista sobrecarregada, leads escapam | BR: ~1.2M escritórios |
| Serviços locais (salão, barbearia, pet shop, personal) | Dono faz tudo — atender, agendar, cobrar | BR: ~5M microempresas de serviço |

**Expansão (mês 3-6):** Mesmos verticais em ES (LATAM: Argentina, Colômbia, México) e EN (US small business).

---

## 2. Proposta de Valor

> **"Uma recepcionista de IA que atende seus clientes 24/7 pelo WhatsApp e telefone — como se fosse alguém da sua equipe."**

Não é um bot de FAQ. É um agente que:

- Conhece seus serviços, preços e disponibilidade
- Conversa naturalmente (não parece robô)
- Agenda, confirma e lembra dos compromissos
- Liga para o cliente quando precisa
- Aprende o estilo de atendimento do profissional (memória semântica)
- Fala PT, ES ou EN nativamente

**Diferencial vs. incumbentes** (ManyChat, Tidio, chatbots de fluxo): eles são fluxos rígidos. Nós somos um agente com identidade, memória e autonomia.

---

## 3. Canais

| Canal | Fase | Custo |
|---|---|---|
| **WhatsApp direto** (cold outreach para profissionais locais) | Mês 1 | Baixo — o próprio backbone faz o outreach |
| **Conteúdo vertical** (Instagram/TikTok: "como perdi 30 clientes por não responder WhatsApp") | Mês 1-2 | Tempo |
| **Marketplaces de agentes** (GPT Store, futuros marketplaces da Anthropic/Google) | Mês 2-3 | Grátis |
| **Parcerias com consultorias de nicho** (consultores de clínicas, mentores de estética) | Mês 3-4 | Revenue share |
| **Product Hunt / Hacker News** (versão EN) | Mês 2 | Grátis |

---

## 4. Relacionamento com Cliente

- **Onboarding guiado**: 30min de call onde o agente já sai configurado e atendendo
- **Self-service escalável**: portal onde o profissional ajusta persona, horários, serviços, preços
- **O agente É o relacionamento**: quanto mais usa, mais aprende, mais difícil trocar (lock-in orgânico via memória)

---

## 5. Fontes de Receita

**Meta: R$50k/mês no mês 6.**

| Tier | Preço | Inclui |
|---|---|---|
| **Starter** | R$197/mês | 1 agente, WhatsApp, agenda básica, 500 msgs/mês |
| **Pro** | R$497/mês | 1 agente, WhatsApp + voz, memória, agenda integrada, ilimitado |
| **Clínica** | R$997/mês | Multi-profissional (1 agente por profissional na clínica), dashboard |

**Mix projetado mês 6:**

| Tier | Qtd | Receita |
|---|---|---|
| Starter | 30 | R$5.910 |
| Pro | 40 | R$19.880 |
| Clínica | 10 | R$9.970 |
| White-label / integrador | 5 projetos | R$15.000 |
| **Total** | | **~R$50.760/mês** |

---

## 6. Recursos-Chave

| Recurso | Status |
|---|---|
| Backbone runtime (agentes autônomos) | Existe |
| WhatsApp connector (Evolution — 36 tools) | Existe |
| Voz (Twilio + ElevenLabs) | Existe |
| Memória semântica (embeddings + SQLite-vec + FTS5) | Existe |
| Workflow para produzir portais/dashboards rápido | Existe |
| Billing/compliance no backbone | Existe (módulos implementados) |
| Landing page / portal do cliente | Precisa construir |
| Painel de onboarding self-service | Precisa construir |

---

## 7. Atividades-Chave

| Atividade | Responsável |
|---|---|
| Construir portal de onboarding + painel do cliente | Workflow (o próprio workflow produz os entregáveis) |
| Configurar verticais (templates de SOUL.md por profissão) | Guga + backbone |
| Aquisição de clientes iniciais (BR) | Outreach direto + conteúdo |
| Localização ES/EN | LLM nativo — custo marginal zero |
| Suporte N1 | O próprio agente (meta: o produto suporta a si mesmo) |

---

## 8. Parcerias-Chave

| Parceiro | Valor |
|---|---|
| **OpenRouter** | Multi-model, custo otimizado |
| **Evolution API** | WhatsApp sem custo de API oficial |
| **Twilio** | Voz/SMS global |
| **Consultores de nicho** (mentores de clínicas, coaches de estética) | Canal de distribuição — eles recomendam, ganham % |
| **Integradores locais** (agências digitais que atendem profissionais) | White-label — eles vendem, vocês operam |

---

## 9. Estrutura de Custos

| Custo | Estimativa mensal (mês 6) |
|---|---|
| LLM (OpenRouter — ~$0.01-0.03/msg, ~1000 msgs/dia) | R$3.000-5.000 |
| WhatsApp (Evolution self-hosted) | R$500 (infra) |
| Twilio (voz) | R$1.000-2.000 |
| Infra (VPS, Redis, SQLite) | R$500-1.000 |
| Guga (tempo) | — (founder) |
| Marketing/conteúdo | R$1.000-2.000 |
| **Total estimado** | **~R$7.000-10.000** |
| **Margem bruta** | **~80%** |

---

## Riscos e Investigações Pendentes

1. **Concorrência direta**: quem já vende "recepcionista IA por WhatsApp" no Brasil e no mundo? A que preço? Com que qualidade? Isso define se temos espaço ou se estamos entrando numa briga sangrenta.

2. **Unit economics reais**: quanto custa operar 1 agente por mês (LLM + WhatsApp + voz + infra)? Isso define o piso de preço viável.

3. **Velocidade de onboarding**: se leva 30min, escala. Se leva 3 dias, não atinge 80 clientes em 6 meses.

---

## Contexto: O que a KeepCoding já tem

A KeepCoding não é uma empresa de dev tools. É uma **fábrica de produtos verticais de IA** com duas ferramentas de produção próprias:

| Ferramenta | O que faz | Prova de conceito |
|---|---|---|
| **Agentic Backbone** | Runtime de agentes autônomos — conversa, liga, agenda, lembra — 24/7 via WhatsApp/voz. 13+ connectors. | Luciana Fisioterapeuta: agente criou outro agente, atendeu clientes, gerenciou agenda |
| **Agentic Workflow** | Motor de execução de qualquer cadeia de trabalho agentica — de brief a entregável. Não se limita a software: produz ebooks, música, criativos para redes sociais, campanhas de marketing, planilhas, documentos, malas diretas, e qualquer workflow orquestrado por agentes. | Chega.la (SaaS), Risco Zero, Pneu SOS, reindexação de milhares de arquivos em Obsidian/LYT, playtesting de jogos com 6 agentes autônomos |

A combinação permite **construir, operar e produzir** em velocidade que nenhuma agency ou startup normal consegue — seja software, conteúdo, campanhas ou operações de escritório.
