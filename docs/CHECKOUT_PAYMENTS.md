# Fase 05 — Checkout e pagamentos Asaas

## Status

Banco, backend e frontend de pagamentos implementados, aplicados e validados. O código está pronto para homologação transacional no sandbox, que depende da configuração segura das credenciais no ambiente de deploy.

## Banco

- `billing_profiles`: CPF normalizado e validado, separado do perfil geral.
- `asaas_customers`: vínculo privado entre usuário e cliente Asaas.
- `payment_attempts`: tentativas idempotentes e snapshots financeiros.
- `asaas_webhook_events`: inbox privada e idempotente dos eventos Asaas.
- RLS habilitada e forçada nas quatro tabelas.
- CPF validado por dígitos verificadores.

## Backend

### `POST /api/payments/pix`

- exige sessão autenticada;
- valida checkout pertencente ao usuário e em estado `READY`;
- cria ou reutiliza o cliente no Asaas por CPF;
- cria tentativa idempotente;
- cria cobrança Pix;
- retorna identificador, status, QR Code e payload copia-e-cola.

### `POST /api/payments/card`

- exige sessão autenticada;
- recebe os dados do cartão exclusivamente em memória;
- exige IP remoto;
- aplica a quantidade de parcelas calculada pelo checkout;
- não persiste número, CVV ou validade;
- retorna somente identificador e estado da tentativa.

### `POST /api/webhooks/asaas`

- valida `asaas-access-token` com comparação constante;
- registra o evento antes do processamento;
- ignora eventos duplicados;
- relaciona a cobrança pelo `externalReference`;
- atualiza o estado interno da tentativa;
- responde de modo idempotente.

## Frontend

- CPF de cobrança validado e salvo sob a sessão autenticada;
- Pix conectado ao endpoint interno, com QR Code e copia-e-cola;
- cartão conectado ao endpoint interno, com parcelamento conforme a faixa;
- dados do cartão mantidos somente em memória;
- erros do gateway apresentados sem expor detalhes internos.

## Segurança

`SUPABASE_SECRET_KEY`, `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` são variáveis server-only. Nenhuma usa o prefixo `NEXT_PUBLIC_`.

Somente o CPF pode ser gravado pelo usuário autenticado, sob RLS. Tentativas, identificadores do Asaas e webhooks são escritos exclusivamente pelo backend. Usuários consultam apenas as próprias tentativas e não recebem payload bruto de webhook.

## Configuração

Variáveis obrigatórias:

```dotenv
SUPABASE_SECRET_KEY=
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_API_URL=https://api-sandbox.asaas.com/v3
```

URL do webhook no sandbox:

```text
https://<dominio-de-homologacao>/api/webhooks/asaas
```

O token configurado no Asaas deve ser exatamente o mesmo valor de `ASAAS_WEBHOOK_TOKEN` no deploy.

## Validação concluída

- TypeScript strict aprovado;
- build Next.js aprovado;
- 33 testes automatizados aprovados;
- contratos Pix, cartão e webhook aprovados;
- CPF válido aceito;
- CPF repetido ou inválido recusado;
- navegador sem escrita direta em pagamentos ou webhooks;
- nenhuma informação sensível de cartão persistida.

## Homologação

O deployment de produção deve apontar para o commit do frontend integrado ou posterior. Depois do deploy, validar em sandbox: criação de Pix, cobrança por cartão, recebimento idempotente do webhook e transição da tentativa para pagamento confirmado.

## Próxima etapa

Configurar as três secrets no ambiente de homologação e executar o fluxo completo no Asaas sandbox: Pix, cartão parcelado, webhook, confirmação do pagamento e criação do pedido.
