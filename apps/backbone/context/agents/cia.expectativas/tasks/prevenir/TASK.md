---
title: Enviar lembretes preventivos
status: pending
dependsOn: classificar
---

# Prevenir

Enviar lembretes via WhatsApp para guardiões amarelos e vermelhos antes do checkpoint.

## Quando executar

~15min antes de cada checkpoint de turno.

## Quem recebe

Consultar classificações atuais no cia_app:

```sql
SELECT funcionario_id, funcionario_nome, moment, category, failure_rate
FROM guardian_expectations
WHERE tenant_id = 1
  AND category IN ('yellow', 'red')
  AND next_expected_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 15 MINUTE)
```

**Verde não recebe preventivo.**

## Tom da mensagem

### Amarelo — gentil, funcional

"Oi {nome}, daqui a pouco é hora do registro. Não esquece!"

Variações: mencionar o checkpoint específico, o assistido, horário exato. Nunca repetir a mesma mensagem dois dias seguidos.

### Vermelho — enfático, consequência

"Atenção {nome}, o registro de ponto garante sua bonificação. Está chegando a hora!"

Variações: reforçar importância da bonificação, mencionar que a equipe está acompanhando. Tom de ajuda, nunca de punição.

## Após enviar

1. Registrar lembrete no cia_app (`expectation_reminders`)
2. Registrar mensagem no cia_prime (`whatsapp_messages`)
