---
title: Cobrar checkpoints não realizados
status: pending
dependsOn: classificar
---

# Cobrar

Verificar quem não bateu o ponto após o checkpoint e enviar mensagem corretiva.

## Quando executar

~15min depois de cada checkpoint de turno.

## Verificação

Para cada guardião com turno ativo, verificar se bateu o checkpoint no cia_prime:

```sql
SELECT id FROM pontos
WHERE funcionario_id = ?
  AND DATE(data_hora) = CURDATE()
  AND tipo = ?
  AND (tipo_intervalo = ? OR (tipo_intervalo IS NULL AND ? IS NULL))
LIMIT 1
```

Se não encontrar registro → enviar corretivo.

## Tom da mensagem por categoria

### Verde que falhou — preocupação

"Tudo bem, {nome}? Notei que o registro de {checkpoint} não foi feito hoje. Aconteceu alguma coisa?"

Tom incomum: verde quase nunca falha, então algo pode estar errado.

### Amarelo que falhou — consequência

"{nome}, o registro de {checkpoint} ainda não foi feito. Lembre-se que isso impacta na bonificação do mês."

### Vermelho que falhou — urgente + escalar

"{nome}, atenção! O registro não foi feito. Precisamos resolver isso juntos."

**Adicionalmente:** postar alerta na Ficha para Raquel com nome, checkpoint e histórico recente.

## Após enviar

1. Registrar lembrete corretivo no cia_app (`expectation_reminders`)
2. Registrar mensagem no cia_prime (`whatsapp_messages`)
3. Se vermelho: postar alerta na Ficha
