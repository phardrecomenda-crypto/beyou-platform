# Fase 05 — Checkout: Banco

## Status

Concluído e aplicado no Supabase oficial.

## Carrinho

### carts

Mantém um único carrinho ativo por usuário autenticado. Usa UUID, moeda BRL, expiração de 30 dias e estados `ACTIVE`, `CONVERTED`, `ABANDONED` e `EXPIRED`.

### cart_items

Preserva nome, SKU e preço unitário no momento da inclusão. O banco aceita exclusivamente uma unidade de cada produto por carrinho.

### cart_summaries

View com `security_invoker` que calcula quantidade, subtotal, valor restante e qualificação para frete grátis. A meta oficial é 60.000 centavos, equivalente a R$ 600,00.

## Endereços

`customer_addresses` armazena endereços brasileiros pertencentes ao usuário, com CEP, telefone e UF validados. Existe no máximo um endereço padrão por usuário.

## Rascunho do checkout

`checkout_drafts` mantém um rascunho único por carrinho. Subtotal, desconto, frete, total, moeda, usuário e status são calculados e protegidos no banco.

Regras:

- Pix: 3% de desconto e uma parcela;
- cartão até R$ 499,99: máximo de 3 parcelas;
- cartão entre R$ 500,00 e R$ 999,99: máximo de 6 parcelas;
- cartão a partir de R$ 1.000,00: máximo de 10 parcelas;
- frete grátis a partir de R$ 600,00;
- frete abaixo da meta permanece pendente até a cotação;
- assinaturas permanecem fora desta fase.

## Segurança

- RLS habilitada e forçada em carrinhos, itens, endereços e rascunhos;
- políticas usam `auth.uid()` e propriedade do recurso;
- usuários anônimos não possuem grants;
- privilégios por coluna impedem que o cliente escreva campos financeiros ou de propriedade;
- triggers usam `security invoker`;
- funções internas não podem ser executadas diretamente pela API;
- consultas públicas não usam `SELECT *`.

## Validação executada

Carrinho real de teste com subtotal de R$ 619,00:

- Pix normalizado para uma parcela;
- desconto calculado em R$ 18,57;
- frete grátis aplicado;
- total calculado em R$ 600,43;
- tentativa de 10 parcelas recusada, pois a faixa permite no máximo 6;
- testes executados com transação e rollback, sem manter dados artificiais.

## Arquivos

- `supabase/migrations/20260803163453_checkout_addresses_and_drafts.sql`
- `supabase/tests/checkout_addresses_and_drafts.sql`

## Próxima etapa

Implementar Application e Infrastructure do checkout: validação Zod, repositórios, server actions e cotação de frete; depois concluir a interface.
