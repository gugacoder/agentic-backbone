---
name: PostgreSQL
engine: postgres
description: Conector para bancos de dados PostgreSQL
---

# PostgreSQL Connector

Conector para bancos de dados PostgreSQL via `pg`.

## Arquivos do Engine

| Arquivo | Função |
|---------|--------|
| `adapter.mjs` | Factory Node.js — `createAdapter(dir)` → `{ query, mutate, close }` |
| `exec.mjs` | Executor CLI — `node exec.mjs <env-path> <query\|mutate> "<sql>"` |

## Exploração

Use `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'` para listar tabelas e `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '<tabela>'` para explorar a estrutura.
