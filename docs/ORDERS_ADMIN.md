# Orders — operação administrativa

O painel `/admin/pedidos` permite acompanhar até 200 pedidos recentes e executar apenas transições válidas.

- `SUPER_ADMIN` e `ADMIN`: expedição, entrega, cancelamento e registro de estorno.
- `SUPORTE`: preparação, expedição e entrega; não cancela nem estorna.
- Demais perfis: sem acesso ao painel ou à ação.

O PostgreSQL bloqueia saltos e retrocessos, exige transportadora e rastreamento para `SHIPPED` e grava toda alteração em `order_status_history` na mesma transação. A função de escrita é exclusiva de `service_role` e só é chamada após validação da sessão e do perfil no servidor.
