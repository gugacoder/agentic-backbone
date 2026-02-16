# 11 Tips For AI Coding With Ralph Wiggum

> Source: https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum

## Core Concept

Ralph Wiggum é uma abordagem de "long-running, autonomous, and unsupervised AFK coding" que contrasta com abordagens tradicionais human-in-the-loop. Em vez de humanos especificarem cada passo, desenvolvedores definem resultados desejados e deixam o agente IA determinar estratégias de implementação.

---

## The 11 Tips

### 1. Ralph Is A Loop

Automatiza seleção de tarefas em vez de requerer que humanos escrevam novos prompts para cada fase. **O agente escolhe a tarefa, não você.**

### 2. Start With HITL, Then Go AFK

Comece com supervisão human-in-the-loop antes de rodar iterações autônomas. Isso ajuda a calibrar o comportamento do agente.

### 3. Define The Scope

Especifique estados finais usando formatos como JSON PRDs com condições pass/fail. Clareza no escopo é fundamental para sucesso autônomo.

### 4. Track Ralph's Progress

Mantenha arquivos de progresso para que agentes pulem exploração redundante. Isso evita que o agente repita trabalho já feito.

### 5. Use Feedback Loops

Implemente guardrails através de:
- TypeScript types
- Tests (unit, integration)
- Linting
- Pre-commit hooks

Esses mecanismos fornecem feedback automático ao agente sobre a qualidade do código produzido.

### 6. Take Small Steps

Priorize qualidade através de iterações focadas em vez de grandes context windows. Passos menores = menos chance de erros catastróficos.

### 7. Prioritize Risky Tasks

Aborde decisões arquiteturais e pontos de integração ANTES de trabalho rotineiro. Riscos técnicos devem ser validados cedo.

### 8. Explicitly Define Software Quality

Comunique padrões de produção para prevenir aceleração de entropia. O agente precisa saber o que é "bom o suficiente".

### 9. Use Docker Sandboxes

Isole agentes autônomos para segurança durante execuções não supervisionadas. Contenha o blast radius de erros.

### 10. Pay To Play

Reconheça custos computacionais; modelos locais atualmente insuficientes para output confiável. Qualidade tem custo.

### 11. Make It Your Own

Customize fontes do loop (GitHub, Linear, Beads) e tipos alternativos de tarefas. Ralph é flexível.

---

## Key Insights

- **O agente escolhe a tarefa, não você** — departure significativo de abordagens de planejamento multi-fase
- Sucesso depende de combinar **definição explícita de escopo** com **mecanismos robustos de feedback**

## Alternative Loop Applications

- Test coverage optimization
- Code duplication detection
- Linting automation
- Entropy reduction

Demonstra flexibilidade do Ralph além de desenvolvimento de features.
