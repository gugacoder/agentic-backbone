---
title: Classificar guardiões
status: pending
adapters:
  - cia-prime
  - cia-app
---

# Classificar

Calcular a taxa de falha de cada guardião por checkpoint e classificar em verde/amarelo/vermelho.

## Quando executar

Uma vez por dia, no início do primeiro turno.

## Como executar

Submeter como job supervisionado via tool `submit_job`:
- command: `node <agent_dir>/tasks/classificar/classificar.mjs`
- timeout: 300

O backbone spawna o processo, captura output e te acorda quando terminar.
Consulte o resultado com a tool `get_job`.

O script retorna JSON em stdout com as classificações e mudanças de faixa detectadas.

## Schema

### cia_prime

**calendario_escalas** — turnos do dia
- `funcionario_id`, `assistido_id`, `startDate`, `endDate`, `tenant_id`

**funcionarios** — dados do guardião
- `id`, `nome`, `num_celular`, `ativo`

**pontos** — registros de ponto
- `funcionario_id`, `data_hora`, `tipo` (entrada/saida), `tipo_intervalo` (NULL, plantao, cafe_manha, almoco, cafe_tarde, janta, noturno)

**interval_configs** — janelas de tempo dos checkpoints
- `interval`, `start`, `end`

### cia_app

**guardian_expectations** — classificação persistida
- `funcionario_id`, `funcionario_nome`, `moment`, `category` (green/yellow/red), `failure_rate`, `failures_count`, `opportunities_count`

## Regras de classificação

- **Verde** (0-10% falha): assíduo, não precisa de intervenção preventiva
- **Amarelo** (11-50% falha): em desenvolvimento, precisa de lembretes
- **Vermelho** (51-100% falha): suporte intensivo

Taxa de falha = (checkpoints esperados - checkpoints realizados) / checkpoints esperados × 100

Checkpoints esperados são derivados do cruzamento turno × interval_configs.
