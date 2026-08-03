# Fase 05 — Checkout: Backend do Carrinho

## Status

Implementado e versionado. A publicação automática aguarda disponibilidade de build da Vercel.

## Arquitetura

- `modules/checkout/domain`: entidades, estados, constantes e erros do carrinho.
- `modules/checkout/application`: contratos do repositório, sessão e serviço de aplicação.
- `modules/checkout/infrastructure`: repositório Supabase, sessão autenticada e fábrica.
- `tests/checkout-backend-contract.test.mjs`: contratos automatizados do backend.

Nenhum componente React acessa diretamente as tabelas de carrinho.

## Operações

### getActive

Retorna o carrinho ativo do usuário autenticado, incluindo itens e resumo calculado pelo banco.

### getOrCreateActive

Retorna o carrinho existente ou cria um novo. A constraint de um carrinho ativo por usuário resolve concorrência; em caso de disputa, o serviço recarrega o carrinho criado pela requisição vencedora.

### addProduct

- exige sessão autenticada;
- cria ou recupera o carrinho ativo;
- envia apenas `cart_id`, `product_id` e quantidade fixa;
- confia no trigger do banco para preservar nome, SKU e preço;
- converte duplicidade e indisponibilidade em erros de domínio;
- retorna o carrinho recalculado.

### removeProduct

- exige sessão autenticada;
- remove exclusivamente do carrinho pertencente ao usuário sob RLS;
- retorna o carrinho recalculado.

## Segurança

- A sessão é validada com `auth.getUser()`.
- O backend não utiliza metadados editáveis para autorização.
- Todas as consultas usam colunas explícitas.
- RLS permanece como barreira final contra acesso entre clientes.
- Preços e qualificação de frete não são calculados nem aceitos do navegador.
- A service role não é utilizada.
- Assinaturas não fazem parte deste pacote.

## Erros de domínio

- `AUTHENTICATION_REQUIRED`
- `PRODUCT_ALREADY_IN_CART`
- `ACTIVE_CART_ALREADY_EXISTS`
- `PRODUCT_UNAVAILABLE`
- `ACTIVE_CART_NOT_FOUND`

## Próxima integração

Server Actions e componentes do carrinho utilizarão exclusivamente `CartService`. A interface deverá apresentar os dados retornados por `cart_summaries`, incluindo progresso até R$ 600,00.
