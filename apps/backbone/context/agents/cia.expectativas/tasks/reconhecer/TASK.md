---
title: Reconhecer melhora de faixa
status: pending
dependsOn: classificar
---

# Reconhecer

Quando a task Classificar detecta mudança de faixa positiva, enviar reforço positivo via WhatsApp.

## Quando executar

Imediatamente após a classificação diária, se houver mudanças positivas.

## Mudanças que geram reconhecimento

- **Vermelho → amarelo:** "Boa, {nome}! Sua consistência está melhorando. Continue assim!"
- **Amarelo → verde:** "Parabéns, {nome}! Registro impecável nos últimos dias. Excelente trabalho!"

## Mudanças que NÃO geram mensagem ao funcionário

- **Verde → amarelo** ou **amarelo → vermelho:** registrar na Ficha para Raquel, mas não comunicar ao funcionário (evitar tom punitivo).

## Após enviar

1. Registrar mensagem no cia_prime (`whatsapp_messages`)
2. Postar na Ficha: "{nome} melhorou de {antiga} para {nova}"
