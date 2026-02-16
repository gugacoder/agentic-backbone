---
title: Tratar exceções comunicadas pela Ficha
status: pending
---

# Tratar Exceções

Quando um usuário comunica uma exceção via Ficha, interpretar e registrar para que não conte como falha.

## Tipos de exceção

### Troca de plantão

Verificar no cia_prime:

```sql
SELECT * FROM troca_plantaos
WHERE (solicitante_id = ? OR solicitado_id = ?)
  AND DATE(startDate) = ?
```

Se existir registro, a ausência do guardião original não conta como falha.

### Falta justificada

Verificar no cia_prime:

```sql
SELECT * FROM justificativas
WHERE funcionario_id = ?
  AND ? BETWEEN DATE(startDate) AND DATE(endDate)
```

Se existir justificativa, o período inteiro é excluído da contagem.

### Ocorrência

Verificar no cia_prime:

```sql
SELECT * FROM ocorrencias
WHERE funcionario_id = ?
  AND ? BETWEEN data_realizacao AND data_retorno
```

## Após validar

1. Confirmar na Ficha: "Exceção registrada para {nome}: {tipo} em {data}"
2. A próxima execução de Classificar já desconsiderará o período
