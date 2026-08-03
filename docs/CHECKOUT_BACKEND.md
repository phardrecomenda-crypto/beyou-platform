# Fase 05 — Checkout: Backend do Carrinho

## Status

Implementado, auditado e versionado.

## Arquitetura

- `modules/checkout/domain`: entidades, estados, constantes e erros do carrinho.
- `modules/checkout/application`: contratos do repositório, sessão e serviço.
- `modules/checkout/infrastructure`: repositório Supabase, sessão autenticada e fábrica.
- `app/loja/cart-actions.ts`: operações seguras consumidas pela apresentação.
- `tests/checkout-backend-contract.test.mjs`: contratos automatizados.

Nenhum componente React acessa diretamente as tabelas do carrinho.

## Operações

### getActive

Retorna o carrinho ativo autenticado, seus itens e o resumo calculado no banco.

### getOrCreateActive

Retorna o carrinho existente ou cria um novo. Requisições concorrentes são resolvidas pela constraint de um carrinho ativo e pela recuperação do registro vencedor.

### addProduct

- valida o produto como UUID;
- exige sessão autenticada;
- cria ou recupera o carrinho ativo;
- envia apenas carrinho, produto e quantidade fixa;
- preserva preço, nome e SKU pelo trigger do banco;
- trata adições repetidas como sucesso idempotente;
- retorna o carrinho recalculado.

### removeProduct

- valida o produto como UUID;
- exige sessão autenticada;
- remove exclusivamente do carrinho do usuário sob RLS;
- retorna o carrinho recalculado.

## Segurança

- A sessão é validada com `auth.getUser()`.
- O backend nunca aceita `user_id` do navegador.
- Identificadores são normalizados e validados.
- Consultas usam colunas explícitas e filtros de propriedade.
- RLS é a autoridade final contra acesso entre clientes.
- Preços e frete não são aceitos nem calculados no navegador.
- Nenhuma chave privilegiada é utilizada.
- Assinaturas não fazem parte deste pacote.

## Idempotência

A criação simultânea de carrinhos recupera o registro vencedor. Adicionar novamente o mesmo produto mantém apenas uma unidade e retorna o carrinho atual, sem duplicar linhas.

## Próxima integração

A interface consumirá exclusivamente `CartService` e as Server Actions. O próximo pacote implementará drawer responsivo, barra de frete grátis, order bump e estados de carregamento e erro.
