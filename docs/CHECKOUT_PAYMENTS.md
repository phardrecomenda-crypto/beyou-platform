# Fase 05 — Fundação de pagamentos Asaas

## Status

Banco aplicado e validado no Supabase oficial.

## Estruturas

- `billing_profiles`: CPF normalizado e validado, separado do perfil geral.
- `asaas_customers`: vínculo privado entre usuário e cliente Asaas.
- `payment_attempts`: tentativas idempotentes e snapshots financeiros.
- `asaas_webhook_events`: inbox privada e idempotente dos eventos Asaas.

## Segurança

Somente o CPF pode ser gravado pelo usuário autenticado, sob RLS. Tentativas, identificadores do Asaas e webhooks são escritos exclusivamente pelo backend com uma secret key server-only. Usuários podem consultar apenas suas tentativas e nunca recebem payload bruto de webhook.

A chave Asaas, token do webhook e secret key Supabase não usam prefixo `NEXT_PUBLIC_` e nunca entram no bundle.

## Validação

- CPF válido aceito;
- CPF repetido recusado;
- dígito verificador incorreto recusado;
- RLS habilitada e forçada nas quatro tabelas;
- navegador sem escrita em pagamentos ou webhooks.

## Próxima etapa

Implementar cliente Asaas sandbox, criação idempotente do cliente, cobrança Pix/cartão, QR Code e endpoint de webhook com validação de `asaas-access-token`.
