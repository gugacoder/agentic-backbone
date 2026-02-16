---
name: MySQL
engine: mysql
description: Conector para bancos de dados MySQL e MariaDB
---

# MySQL Connector

Conector para bancos de dados MySQL e MariaDB via `mysql2/promise`.

## Arquivos do Engine

| Arquivo | Função |
|---------|--------|
| `adapter.mjs` | Factory Node.js — `createAdapter(dir)` → `{ query, mutate, close }` |
| `exec.mjs` | Executor CLI — `node exec.mjs <env-path> <query\|mutate> "<sql>"` |

## Exploração

Use `SHOW TABLES` e `DESCRIBE <tabela>` via query.sh para explorar a estrutura do banco.
