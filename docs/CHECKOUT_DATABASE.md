# Fase 05 — Checkout: Fundação do Banco

## Status

Concluído e aplicado no Supabase oficial.

## Entidades

### carts

Mantém um único carrinho ativo por usuário autenticado. O carrinho utiliza UUID, moeda BRL, expiração de 30 dias e estados `ACTIVE`, `CONVERTED`, `ABANDONED` e `EXPIRED`.

### cart_items

Preserva nome, SKU e preço unitário no momento em que o produto é incluído. O banco aceita exclusivamente uma unidade de cada produto por carrinho.

### cart_summaries

View com `security_invoker` que calcula:

- quantidade de itens;
- subtotal;
- valor restante até o frete grátis;
- qualificação para frete grátis.

A meta oficial é 60.000 centavos, equivalente a R$ 600,00.

## Regras obrigatórias

- Somente produtos `ACTIVE`, com estoque e preço, podem entrar no carrinho.
- O cliente não informa nem altera o preço preservado.
- Cada produto aparece no máximo uma vez no mesmo carrinho.
- Assinaturas não fazem parte desta fase.
- Visitantes anônimos não acessam carrinhos.
- Usuários autenticados acessam exclusivamente o próprio carrinho.
- Totais financeiros são calculados no banco, nunca confiados ao navegador.

## Segurança

- RLS habilitada e forçada em `carts` e `cart_items`.
- Políticas usam `auth.uid()` e propriedade do carrinho.
- Grants limitam as colunas aceitas na inclusão.
- A view respeita as políticas das tabelas de origem.
- Consultas públicas não utilizam `SELECT *`.

## Validação executada

- inclusão autenticada;
- preservação do preço oficial do BeFit em 21.590 centavos;
- quantidade forçada para uma unidade;
- duplicidade bloqueada por constraint;
- cálculo de 38.410 centavos restantes para o frete grátis;
- limpeza integral dos dados de teste;
- auditoria de segurança e índices.
