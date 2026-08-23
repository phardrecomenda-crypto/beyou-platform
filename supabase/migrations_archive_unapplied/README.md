# Migrations arquivadas (não aplicadas neste banco)

Estes 16 arquivos existiam no repositório mas os respectivos timestamps
NÃO correspondem a nenhuma entrada em `supabase_migrations.schema_migrations`
no projeto Supabase `beyou-nutrition` (ilzelezljkwajecesray).

O conteúdo delas (criação de tabelas products/orders/checkout_cart com o
schema "novo") parece ter sido substituído por outras migrations que
adicionaram colunas de compatibilidade às tabelas legadas já existentes
(ex: `products_application_schema_compatibility`,
`cart_application_schema_compatibility`, `reconcile_checkout_payments_with_legacy_schema`).

Mantidas aqui por segurança/histórico, mas NÃO devem ficar em
`supabase/migrations/` porque isso faria o `supabase db push` tentar
aplicá-las de novo (e provavelmente falhar, já que boa parte do que elas
criam já existe sob outro nome/migration).

Se alguém confirmar que o conteúdo é mesmo obsoleto, pode apagar esta pasta.
Se alguma parte ainda for necessária, adapte o SQL pra rodar como uma nova
migration com timestamp atual, em vez de restaurar o arquivo original aqui.
