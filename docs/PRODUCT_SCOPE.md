# Escopo do produto — Go Live 1.0

Este documento traduz a Constituição da BEYOU em regras executáveis de produto.

## Critério obrigatório de priorização

Uma funcionalidade somente entra no escopo quando aumentar receita, reduzir
custo, melhorar a experiência, reduzir trabalho manual ou aumentar retenção.
Toda decisão deve registrar qual desses resultados atende.

## Perfis atendidos

| Perfil | Responsabilidade principal | Superfície do produto |
|---|---|---|
| Cliente | Comprar e acompanhar sua jornada | Loja, pedidos, assinatura, BCoins, anamnese e SAC |
| Afiliado | Divulgar e vender | Dashboard, links, indicadores, comissões e wallet |
| Gestor | Desenvolver a rede | Equipe, treinamento, indicadores e bônus de rede |
| Administrador | Operar a empresa | Produtos, pedidos, usuários, CRM, financeiro e relatórios |

## Escopo obrigatório da versão 1.0

1. Fundação técnica e observabilidade
2. Banco de dados com UUID, RLS e auditoria
3. Autenticação e autorização por perfil
4. Catálogo e produtos
5. Checkout interno
6. Pedidos e pagamentos
7. Comissões
8. Wallet
9. Área do Cliente
10. SAC

## Após o núcleo transacional

- Área do Afiliado e do Gestor
- CRM
- Painel Administrativo
- Notificações
- Bê IA
- BCoins e fidelidade
- Assinaturas e recorrência

## Fora do Go Live

- Gamificação ampliada
- Marketplace

Esses itens não devem competir por capacidade com o núcleo transacional da
versão 1.0.

## Métricas de aceite do produto

| Dimensão | Métricas |
|---|---|
| Receita | GMV, MRR, ticket médio, LTV |
| Aquisição | CAC, conversão, ativação |
| Retenção | Churn, retenção, clientes ativos, NPS |
| Operação | Pedidos, tempo médio de atendimento |
| Rede | Afiliados ativos, comissões, wallet movimentada |
| Fidelidade | BCoins emitidos e utilizados |

## Regra de arquitetura

As regras de negócio ficam em Domain e Application. Integrações ficam em
Infrastructure. Componentes, páginas e interação ficam em Presentation. Nenhum
componente React deve decidir regras de comissão, wallet, pedidos ou acesso.
