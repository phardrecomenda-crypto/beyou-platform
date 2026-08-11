# Sprint 08 — Affiliate Engine: banco

## Status

Fundação do banco implementada, aplicada e validada no Supabase oficial.

## Regras financeiras vigentes

- Venda direta: 20% para o afiliado.
- Evolução para 25%: retroativa, inativa por padrão e dependente de aprovação formal da empresa.
- Gestor: 5% no nível 1, 3% no nível 2 e 2% no nível 3.
- Recrutador: 3% no nível 1 e 2% no nível 2.
- Remarketing: exclusivamente 15% para o afiliado e 5% para a empresa.
- O split de remarketing exige atendimento ganho, primeiro contato dentro do SLA e registro auditável.

## Estrutura

As tabelas existentes `affiliate_profiles`, `affiliate_network`, `affiliate_clients` e
`commission_ledger` foram preservadas e endurecidas.

Novas estruturas:

- `affiliate_links`: links e campanhas por afiliado elegível;
- `commission_rules`: regras versionáveis e percentuais oficiais;
- `remarketing_service_records`: atendimento, SLA e resultado;
- `sale_attributions`: vínculo imutável entre pedido, afiliado e canal;
- `company_revenue_allocations`: razão transparente da parcela da empresa.

## Segurança e integridade

- RLS habilitada e forçada;
- escrita financeira bloqueada no navegador;
- beneficiários vinculados obrigatoriamente a `affiliate_profiles`;
- uma única atribuição por pedido;
- lançamentos com chave de idempotência;
- atribuição de remarketing rejeitada sem atendimento válido;
- razão da empresa separada do extrato do afiliado;
- índices em chaves estrangeiras e consultas principais.

## Validação

O teste transacional comprova que:

1. remarketing sem atendimento é bloqueado;
2. atendimento aberto ou incompleto é bloqueado;
3. atendimento ganho dentro do SLA permite a atribuição;
4. os percentuais 20%, 15% e 5% permanecem consistentes;
5. todos os dados de teste são revertidos.

## Próxima etapa

Implementar `AffiliateRepository`, `CommissionRepository`, serviços de aplicação e o
motor idempotente que consumirá pedidos pagos sem permitir cálculo financeiro no navegador.

