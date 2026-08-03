# Fase 05 — Checkout: Frontend do Carrinho

## Status

Implementado e versionado. A publicação automática está temporariamente limitada pela cota de builds da Vercel.

## Componentes

- `CartStore`: estado compartilhado e drawer.
- `OpenCartButton`: acesso pelo cabeçalho.
- `AddToCartButton`: inclusão segura no catálogo e no produto.
- botão flutuante: acesso persistente no desktop e celular.

## Experiência

- drawer responsivo;
- contador de itens;
- subtotal em moeda brasileira;
- barra progressiva até R$ 600,00;
- order bump com todos os produtos disponíveis que ainda não estão no carrinho;
- limite visual e estrutural de uma unidade;
- remoção de produtos;
- retorno ao carrinho após autenticação;
- feedback de indisponibilidade;
- CTA para a próxima etapa do checkout.

## Acessibilidade

- diálogo modal identificado;
- fechamento por Escape;
- foco inicial no botão de fechar;
- bloqueio de rolagem da página;
- progressbar com valor acessível;
- botões com estados desabilitados;
- CTA vazio removido da ordem de tabulação.

## Regras preservadas

- preços vêm do backend;
- nenhum total financeiro é aceito do navegador;
- não há assinatura;
- qualquer produto ativo pode completar a meta de frete;
- adicionar novamente o mesmo produto não duplica a unidade.
