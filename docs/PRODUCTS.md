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

## Validação da fase

- Catálogo oficial conferido diretamente no Supabase.
- Leitura anônima validada sob RLS com quatro produtos ativos.
- RLS habilitada e forçada em todas as tabelas públicas.
- Políticas de leitura e mutação auditadas.
- Bucket, limite de 5 MB e MIME types permitidos auditados.
- Build de produção e testes automatizados aprovados.
- Catálogo e página de detalhes usam entidades normalizadas do domínio.
- Conteúdo, momento, sabor e modo de uso são derivados somente dos metadados oficiais do produto.

## Critério operacional pendente

O banco ainda não possui um perfil `SUPER_ADMIN` ou `ADMIN`. A criação, edição, arquivamento e upload pela interface administrativa permanecem corretamente bloqueados até que os Fundadores + CTO designem formalmente o primeiro administrador.

A implementação técnica da Fase 04 está concluída. A habilitação operacional do painel depende exclusivamente da designação segura do primeiro administrador; nenhum usuário será promovido automaticamente.
