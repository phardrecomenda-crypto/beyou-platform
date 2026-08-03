# Fase 04 — Products

## Escopo

O módulo Products é responsável pelo catálogo público e pela administração de produtos, preços, estoque, estado de publicação e destaque comercial.

## Arquitetura

- `modules/products/domain`: entidade, estados e validação de entrada.
- `modules/products/application`: portas, serviços e autorização.
- `modules/products/infrastructure`: implementação do repositório Supabase e fábrica.
- `modules/products/presentation`: formulários e componentes de interface.
- `app/loja`: catálogo e detalhes públicos.
- `app/admin/produtos`: administração protegida para `SUPER_ADMIN` e `ADMIN`.

Componentes React não acessam diretamente a tabela `products`. Todas as operações passam por `ProductService` e `ProductRepository`.

## Segurança

- RLS habilitada e forçada em `public.products`.
- Visitantes e usuários autenticados leem somente produtos `ACTIVE`.
- Escrita exige perfil ativo com cargo `SUPER_ADMIN` ou `ADMIN`.
- Imagens são armazenadas no bucket público `product-media`; gravações exigem administrador ativo.
- Server Actions repetem a autorização antes de toda mutação.
- Consultas usam listas explícitas de colunas.
- Slug, SKU, preços, estoque e estado são validados no domínio e no PostgreSQL.

## Fluxos

### Catálogo público

1. A página solicita produtos publicados ao serviço.
2. A infraestrutura consulta o Supabase sob RLS.
3. As linhas são convertidas para a entidade de domínio.
4. A apresentação recebe somente entidades normalizadas.

### Administração

1. A sessão é validada pelo Supabase Auth.
2. O perfil ativo e o cargo administrativo são confirmados.
3. A entrada é validada com Zod.
4. O repositório executa a mutação sob RLS.
5. Catálogo, produto e administração são revalidados.

## Critérios de encerramento pendentes

- Executar testes SQL no projeto Supabase oficial.
- Adicionar testes automatizados de domínio, aplicação e Server Actions.
- Validar criação, edição e arquivamento com usuário administrador real.

A Fase 04 permanece em andamento até que todos os critérios acima sejam concluídos.
