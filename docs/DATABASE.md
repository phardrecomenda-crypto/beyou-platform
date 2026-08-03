# Banco de dados

O banco oficial da BEYOU Platform v1 é o novo projeto Supabase limpo, em
PostgreSQL 17. O projeto `beyou-nutrition` anterior permanece somente como
referência e não é uma dependência da aplicação.

## Regras obrigatórias

- UUID em todas as entidades.
- RLS em todas as tabelas expostas.
- Privilégios da Data API concedidos explicitamente.
- `anon` não acessa dados pessoais.
- O frontend nunca recebe `service_role` ou secret key.
- Autorização não utiliza `raw_user_meta_data`.
- Regras de negócio não ficam em componentes React.
- Triggers são usados apenas para automações e integridade.
- Nenhuma consulta de aplicação utiliza `select *`.

## Estado inicial

A primeira migration cria somente a fundação de autenticação: enums de cargo e
status, tabela `profiles`, vínculo com `auth.users`, automações e políticas RLS.
Os demais módulos serão criados em migrations independentes e aprovadas.

## Processo de alteração

1. Inspecionar schema, políticas, funções e dependências.
2. Criar migration pequena e reversível quando possível.
3. Aplicar no projeto oficial.
4. Executar queries de verificação.
5. Rodar os advisors de segurança e desempenho.
6. Versionar migration, testes e decisão técnica no mesmo pacote.
