# Realiza uma sessão de desenvolvimento incremental

Você é o CODING AGENT para uma sessão de desenvolvimento incremental.

## Protocolo de Startup (faça NESTA ORDEM, sem pular):

1. Detecte a versão do harness:
   - Se `.harness/active` existe → **V2** (session-based)
   - Se `agent-harness.json` existe → **V1** (flat)

### V2 (session-based):
1. `cat .harness/active` — identifique a session ativa
2. `cat .harness/$(cat .harness/active)/config.json` — veja a configuração do run
3. `pwd` — confirme o diretório do projeto
4. `cat .harness/$(cat .harness/active)/progress.txt` — entenda o estado atual
5. `cat .harness/$(cat .harness/active)/features.json` — veja a feature list
6. `git log --oneline -10` — veja mudanças recentes
7. `bash agent-setup.sh` — suba o ambiente
8. Faça um SMOKE TEST da funcionalidade existente antes de codar qualquer coisa nova

### V1 (flat — legacy):
1. `cat agent-harness.json` — veja a configuração do run
2. `pwd` — confirme o diretório do projeto
3. `cat agent-progress.txt` — entenda o estado atual
4. `cat features.json` — veja a feature list
5. `git log --oneline -10` — veja mudanças recentes
6. `bash agent-setup.sh` — suba o ambiente
7. Faça um SMOKE TEST da funcionalidade existente antes de codar qualquer coisa nova

## Sua Missão

Selecione a feature de MAIOR PRIORIDADE com status "failing" cujas dependências estejam todas "passing", e implemente-a completamente nesta sessão.

## Regras

- UMA feature por sessão. Foque e termine.
- TESTE antes de marcar como passing — rode os testes definidos na feature.
- Se encontrar bugs de sessões anteriores, CORRIJA PRIMEIRO antes de avançar.
- V2: Consulte o `specs` de `.harness/{session}/config.json` para referências técnicas e specs. Consulte `.harness/learnings.md` para lições aprendidas.
- V1: Consulte o `planning_path` de `agent-harness.json` para referências técnicas e specs.
- Se a feature tiver `prp_path`, leia o PRP para detalhes.
- Ao FINAL da sessão:
  1. Atualize features.json (status da feature para "passing" + completed_at)
     - V2: `.harness/{session}/features.json`
     - V1: `features.json`
  2. Atualize progress (registre o que fez, próxima prioridade)
     - V2: `.harness/{session}/progress.txt`
     - V1: `agent-progress.txt`
  3. Git commit com estado limpo
  4. O código deve estar num estado que outro agente possa continuar sem limpar bagunça

Onde `{session}` é o conteúdo de `.harness/active`.

## Formato do Commit

```
feat(<escopo>): implementar F-XXX <nome da feature>

- O que foi implementado
- Testes que passaram
- Qualquer decisão arquitetural tomada

Progress: X/N features complete
Next: F-YYY <próxima feature>
```

Comece executando o protocolo de startup agora.
