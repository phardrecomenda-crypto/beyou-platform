# Fase 05 — Checkout: Backend

## Status

Backend do carrinho, endereços e rascunho de checkout implementado, auditado e versionado.

## Arquitetura

- `modules/checkout/domain/cart.ts`: entidades e regras do carrinho.
- `modules/checkout/domain/checkout.ts`: endereço, pagamento, rascunho e erros estáveis.
- `modules/checkout/application/cart-service.ts`: casos de uso do carrinho.
- `modules/checkout/application/checkout-service.ts`: validação e início do checkout.
- `modules/checkout/application/*-repository.ts`: portas da aplicação.
- `modules/checkout/infrastructure/supabase-*.ts`: adaptadores Supabase.
- `app/loja/cart-actions.ts`: Server Actions do carrinho.
- `app/checkout/actions.ts`: Server Actions de endereço e checkout.
- `tests/checkout-*-contract.test.mjs`: contratos automatizados.

Componentes React não acessam diretamente as tabelas de checkout.

## Casos de uso

### Carrinho

- recuperar ou criar o carrinho ativo;
- adicionar produto de forma idempotente;
- remover produto;
- hidratar itens e resumo calculado no banco.

### Endereços

- listar apenas os endereços do usuário autenticado;
- validar e normalizar nome, telefone, CEP e UF com Zod;
- criar endereço sem aceitar `user_id` do navegador;
- trocar com segurança o endereço padrão.

### Início do checkout

- validar UUID, meio de pagamento e parcelas;
- confirmar que o endereço pertence ao usuário;
- confirmar carrinho ativo e não vazio;
- criar ou atualizar o rascunho do carrinho;
- retornar somente o snapshot calculado pelo PostgreSQL.

## Segurança

- Sessão validada no servidor com `auth.getUser()`.
- Nenhuma chave privilegiada é usada.
- O backend não aceita `user_id`, subtotal, desconto, frete, total, moeda ou status.
- Consultas usam colunas explícitas, sem `SELECT *`.
- Filtros de propriedade complementam a RLS.
- O PostgreSQL continua como autoridade de preço, Pix, parcelamento e frete grátis.
- Erros retornados à apresentação usam códigos estáveis e não vazam detalhes internos.
- Assinaturas permanecem fora da Fase 05.

## Validação

Executado em checkout limpo do repositório oficial:

- TypeScript strict: aprovado;
- 22 testes automatizados: aprovados;
- 0 falhas;
- contratos de arquitetura, autenticação, ownership, valores protegidos e ausência de assinaturas: aprovados.

## Frete abaixo da meta

Quando o subtotal é inferior a R$ 600,00, o checkout aplica frete fixo de R$ 9,90 (`shipping_cents = 990`). A partir de R$ 600,00, o frete é grátis. O total é sempre calculado antes do envio ao provedor de pagamento.

## Próxima etapa

Construir o frontend do checkout usando `https://beyou-teste-nine.vercel.app/` como base visual: identificação, endereço, entrega, Pix/cartão, parcelamento, resumo e estados de erro/carregamento.
